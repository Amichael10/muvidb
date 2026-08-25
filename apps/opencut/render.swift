import AppKit
import AVFoundation
import CoreGraphics
import CoreMedia
import Foundation
import ImageIO
import UniformTypeIdentifiers

struct VideoConfig: Codable {
  var title: String
  var duration: Double
  var fps: Int
  var width: Int
  var height: Int
  var outputName: String
  var coverName: String?
  var fonts: FontConfig?
  var assets: Assets
  var theme: Theme
  var coverSceneId: String?
  var scenes: [Scene]
}

struct FontConfig: Codable {
  var defaultFamily: String?
  var families: [FontFamily]?
}

struct FontFamily: Codable {
  var id: String
  var label: String
}

struct Assets: Codable {
  var logo: String?
  var background: String?
}

struct Theme: Codable {
  var backgroundColor: String?
  var overlayTop: String?
  var overlayMid: String?
  var overlayBottom: String?
  var accent: String?
  var text: String?
  var muted: String?
}

struct Scene: Codable {
  var id: String
  var name: String
  var start: Double
  var end: Double
  var transition: Transition?
  var background: Background?
  var layers: [Layer]
}

struct Transition: Codable {
  var type: String?
  var duration: Double?
}

struct Background: Codable {
  var image: String?
  var fileName: String?
  var zoom: Double?
  var x: Double?
  var y: Double?
  var animation: BackgroundAnimation?
}

struct BackgroundAnimation: Codable {
  var type: String?
  var startZoom: Double?
  var endZoom: Double?
  var startX: Double?
  var startY: Double?
  var endX: Double?
  var endY: Double?
}

struct Layer: Codable {
  var id: String
  var type: String
  var text: String?
  var source: String?
  var fileName: String?
  var x: Double
  var y: Double
  var width: Double
  var height: Double
  var fontSize: Double?
  var fontFamily: String?
  var weight: String?
  var color: String?
  var align: String?
  var lineHeight: Double?
  var opacity: Double?
  var radius: Double?
  var paddingX: Double?
  var paddingY: Double?
  var fill: String?
  var stroke: String?
}

struct AnimatedImage {
  var frames: [CGImage]
  var durations: [Double]
  var totalDuration: Double
}

struct VideoBackground {
  var asset: AVURLAsset
  var generator: AVAssetImageGenerator
  var duration: Double
}

let dashboardRoot = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
let configPath = CommandLine.arguments.dropFirst().first ?? "config.default.json"
let configURL = URL(fileURLWithPath: configPath, relativeTo: dashboardRoot)
let configData = try Data(contentsOf: configURL)
let config = try JSONDecoder().decode(VideoConfig.self, from: configData)

let outputDir = dashboardRoot.appendingPathComponent("output")
try FileManager.default.createDirectory(at: outputDir, withIntermediateDirectories: true)

let outputURL = outputDir.appendingPathComponent(config.outputName)
if FileManager.default.fileExists(atPath: outputURL.path) {
  try FileManager.default.removeItem(at: outputURL)
}

let coverURL = outputDir.appendingPathComponent(config.coverName ?? "cover.png")

let fontsDir = dashboardRoot.appendingPathComponent("assets/fonts")
let fontURLs = (try? FileManager.default.contentsOfDirectory(at: fontsDir, includingPropertiesForKeys: nil))?.filter {
  $0.pathExtension.lowercased() == "ttf" || $0.pathExtension.lowercased() == "otf"
} ?? []

for fontURL in fontURLs where FileManager.default.fileExists(atPath: fontURL.path) {
  CTFontManagerRegisterFontsForURL(fontURL as CFURL, .process, nil)
}

let width = config.width
let height = config.height
let fps = config.fps
let timelineDuration = max(config.duration, config.scenes.map { $0.end }.max() ?? config.duration)
let totalFrames = Int((timelineDuration * Double(fps)).rounded())

let writer = try AVAssetWriter(outputURL: outputURL, fileType: .mp4)
let videoSettings: [String: Any] = [
  AVVideoCodecKey: AVVideoCodecType.h264,
  AVVideoWidthKey: width,
  AVVideoHeightKey: height,
  AVVideoCompressionPropertiesKey: [
    AVVideoAverageBitRateKey: 8_500_000,
    AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel
  ]
]

let input = AVAssetWriterInput(mediaType: .video, outputSettings: videoSettings)
input.expectsMediaDataInRealTime = false

let attrs: [String: Any] = [
  kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32ARGB,
  kCVPixelBufferWidthKey as String: width,
  kCVPixelBufferHeightKey as String: height
]

let adaptor = AVAssetWriterInputPixelBufferAdaptor(
  assetWriterInput: input,
  sourcePixelBufferAttributes: attrs
)

guard writer.canAdd(input) else {
  fatalError("Cannot add AVAssetWriter video input.")
}
writer.add(input)

var imageCache: [String: NSImage] = [:]
var animatedImageCache: [String: AnimatedImage] = [:]
var videoBackgroundCache: [String: VideoBackground] = [:]

@Sendable func clamp(_ value: CGFloat, _ minValue: CGFloat = 0, _ maxValue: CGFloat = 1) -> CGFloat {
  min(max(value, minValue), maxValue)
}

@Sendable func smoothstep(_ value: CGFloat) -> CGFloat {
  let t = clamp(value)
  return t * t * (3 - 2 * t)
}

@Sendable func lerp(_ a: CGFloat, _ b: CGFloat, _ t: CGFloat) -> CGFloat {
  a + (b - a) * t
}

@Sendable func resolvedURL(_ path: String?) -> URL? {
  guard let path, !path.isEmpty else { return nil }
  if path.hasPrefix("data:") {
    return nil
  }
  if path.hasPrefix("/") {
    return URL(fileURLWithPath: path)
  }
  return dashboardRoot.appendingPathComponent(path)
}

@Sendable func dataFromAsset(_ path: String?) -> Data? {
  guard let path, !path.isEmpty else { return nil }
  if path.hasPrefix("data:") {
    guard let commaIndex = path.firstIndex(of: ",") else { return nil }
    let metadata = path[..<commaIndex]
    let payload = path[path.index(after: commaIndex)...]
    if metadata.contains(";base64") {
      return Data(base64Encoded: String(payload))
    }
    return String(payload).removingPercentEncoding?.data(using: .utf8)
  }
  guard let url = resolvedURL(path) else { return nil }
  return try? Data(contentsOf: url)
}

@Sendable func isVideoPath(_ path: String?) -> Bool {
  guard let raw = path?.lowercased(), !raw.isEmpty else { return false }
  return raw.hasPrefix("data:video/") || raw.contains(".mp4") || raw.contains(".mov") || raw.contains(".m4v") || raw.contains(".webm") || raw.contains("video/")
}

@Sendable func resolvedVideoURL(_ path: String?) -> URL? {
  guard let path, !path.isEmpty else { return nil }
  if path.hasPrefix("data:") {
    guard let data = dataFromAsset(path) else { return nil }
    let lower = path.lowercased()
    let ext = lower.contains("quicktime") || lower.contains(".mov") ? "mov" : "mp4"
    let name = "video-bg-\(abs(path.hashValue)).\(ext)"
    let url = outputDir.appendingPathComponent(name)
    if !FileManager.default.fileExists(atPath: url.path) {
      try? data.write(to: url)
    }
    return url
  }
  return resolvedURL(path)
}

@Sendable func loadImage(_ path: String?) -> NSImage? {
  guard let path else { return nil }
  if let cached = imageCache[path] { return cached }
  let image: NSImage?
  if path.hasPrefix("data:") {
    image = dataFromAsset(path).flatMap { NSImage(data: $0) }
  } else {
    image = resolvedURL(path).flatMap { NSImage(contentsOf: $0) }
  }
  guard let image else { return nil }
  imageCache[path] = image
  return image
}

@Sendable func gifDelay(_ source: CGImageSource, _ index: Int) -> Double {
  guard
    let properties = CGImageSourceCopyPropertiesAtIndex(source, index, nil) as? [CFString: Any],
    let gif = properties[kCGImagePropertyGIFDictionary] as? [CFString: Any]
  else {
    return 0.1
  }
  let unclamped = gif[kCGImagePropertyGIFUnclampedDelayTime] as? Double
  let clamped = gif[kCGImagePropertyGIFDelayTime] as? Double
  return max(unclamped ?? clamped ?? 0.1, 0.03)
}

@Sendable func loadAnimatedImage(_ path: String?) -> AnimatedImage? {
  guard let path else { return nil }
  if let cached = animatedImageCache[path] { return cached }
  guard
    let data = dataFromAsset(path),
    let source = CGImageSourceCreateWithData(data as CFData, nil)
  else {
    return nil
  }
  let count = CGImageSourceGetCount(source)
  guard count > 1 else { return nil }

  var frames: [CGImage] = []
  var durations: [Double] = []
  for index in 0..<count {
    guard let image = CGImageSourceCreateImageAtIndex(source, index, nil) else { continue }
    frames.append(image)
    durations.append(gifDelay(source, index))
  }
  guard !frames.isEmpty else { return nil }
  let total = durations.reduce(0, +)
  let animated = AnimatedImage(frames: frames, durations: durations, totalDuration: total)
  animatedImageCache[path] = animated
  return animated
}

@Sendable func loadVideoBackground(_ path: String?) -> VideoBackground? {
  guard let path, isVideoPath(path) else { return nil }
  if let cached = videoBackgroundCache[path] { return cached }
  guard let url = resolvedVideoURL(path) else { return nil }
  let asset = AVURLAsset(url: url)
  let generator = AVAssetImageGenerator(asset: asset)
  generator.appliesPreferredTrackTransform = true
  generator.requestedTimeToleranceBefore = CMTime(seconds: 0.03, preferredTimescale: 600)
  generator.requestedTimeToleranceAfter = CMTime(seconds: 0.03, preferredTimescale: 600)
  let seconds = CMTimeGetSeconds(asset.duration)
  let video = VideoBackground(asset: asset, generator: generator, duration: seconds.isFinite && seconds > 0 ? seconds : 0)
  videoBackgroundCache[path] = video
  return video
}

@Sendable func frameForVideoBackground(_ video: VideoBackground, time: Double) -> CGImage? {
  let loopTime = video.duration > 0 ? time.truncatingRemainder(dividingBy: video.duration) : 0
  return try? video.generator.copyCGImage(at: CMTime(seconds: loopTime, preferredTimescale: 600), actualTime: nil)
}

@Sendable func frameForAnimatedImage(_ animated: AnimatedImage, time: Double) -> CGImage {
  let loopTime = animated.totalDuration > 0 ? time.truncatingRemainder(dividingBy: animated.totalDuration) : 0
  var cursor = 0.0
  for (index, duration) in animated.durations.enumerated() {
    cursor += duration
    if loopTime <= cursor {
      return animated.frames[index]
    }
  }
  return animated.frames.last!
}

@Sendable func roundedRectPath(_ rect: CGRect, radius: CGFloat) -> CGPath {
  CGPath(roundedRect: rect, cornerWidth: radius, cornerHeight: radius, transform: nil)
}

@Sendable func parseColor(_ value: String?, fallback: NSColor = .white) -> NSColor {
  guard let raw = value?.trimmingCharacters(in: .whitespacesAndNewlines), !raw.isEmpty else {
    return fallback
  }

  if raw.hasPrefix("#") {
    let hex = String(raw.dropFirst())
    guard hex.count == 6, let int = Int(hex, radix: 16) else { return fallback }
    return NSColor(
      red: CGFloat((int >> 16) & 0xff) / 255,
      green: CGFloat((int >> 8) & 0xff) / 255,
      blue: CGFloat(int & 0xff) / 255,
      alpha: 1
    )
  }

  if raw.hasPrefix("rgba") {
    let body = raw
      .replacingOccurrences(of: "rgba(", with: "")
      .replacingOccurrences(of: ")", with: "")
    let parts = body.split(separator: ",").compactMap { Double($0.trimmingCharacters(in: .whitespaces)) }
    if parts.count == 4 {
      return NSColor(
        red: CGFloat(parts[0]) / 255,
        green: CGFloat(parts[1]) / 255,
        blue: CGFloat(parts[2]) / 255,
        alpha: CGFloat(parts[3])
      )
    }
  }

  return fallback
}

@Sendable func brandFont(size: CGFloat, family: String?, weight: String?) -> NSFont {
  let selectedFamily = family ?? config.fonts?.defaultFamily ?? "Manrope"
  let fontNames: [String: [String: [String]]] = [
    "Manrope": [
      "regular": ["Manrope-Regular", "Manrope"],
      "medium": ["Manrope-Medium", "Manrope"],
      "semiBold": ["Manrope-SemiBold", "Manrope"],
      "bold": ["Manrope-Bold", "Manrope"],
      "heavy": ["Manrope-ExtraBold", "Manrope-Bold", "Manrope"]
    ],
    "Inter": [
      "regular": ["Inter-Regular", "Inter"],
      "medium": ["Inter-Medium", "Inter"],
      "semiBold": ["Inter-SemiBold", "Inter"],
      "bold": ["Inter-Bold", "Inter"],
      "heavy": ["Inter-Bold", "Inter"]
    ],
    "InstrumentSans": [
      "regular": ["InstrumentSans-Regular", "Instrument Sans"],
      "medium": ["InstrumentSans-Medium", "Instrument Sans"],
      "semiBold": ["InstrumentSans-SemiBold", "Instrument Sans"],
      "bold": ["InstrumentSans-Bold", "Instrument Sans"],
      "heavy": ["InstrumentSans-Bold", "Instrument Sans"]
    ],
    "Georgia": [
      "regular": ["Georgia"],
      "medium": ["Georgia"],
      "semiBold": ["Georgia-Bold", "Georgia"],
      "bold": ["Georgia-Bold", "Georgia"],
      "heavy": ["Georgia-Bold", "Georgia"]
    ],
    "Palatino": [
      "regular": ["Palatino-Roman", "Palatino"],
      "medium": ["Palatino-Roman", "Palatino"],
      "semiBold": ["Palatino-Bold", "Palatino"],
      "bold": ["Palatino-Bold", "Palatino"],
      "heavy": ["Palatino-Bold", "Palatino"]
    ],
    "Baskerville": [
      "regular": ["Baskerville", "Baskerville-Regular"],
      "medium": ["Baskerville", "Baskerville-Regular"],
      "semiBold": ["Baskerville-SemiBold", "Baskerville-Bold", "Baskerville"],
      "bold": ["Baskerville-Bold", "Baskerville"],
      "heavy": ["Baskerville-Bold", "Baskerville"]
    ],
    "TimesNewRoman": [
      "regular": ["TimesNewRomanPSMT", "Times New Roman"],
      "medium": ["TimesNewRomanPSMT", "Times New Roman"],
      "semiBold": ["TimesNewRomanPS-BoldMT", "Times New Roman"],
      "bold": ["TimesNewRomanPS-BoldMT", "Times New Roman"],
      "heavy": ["TimesNewRomanPS-BoldMT", "Times New Roman"]
    ],
    "NewYork": [
      "regular": ["NewYork-Regular", "New York"],
      "medium": ["NewYork-Regular", "New York"],
      "semiBold": ["NewYork-Semibold", "NewYork-Bold", "New York"],
      "bold": ["NewYork-Bold", "New York"],
      "heavy": ["NewYork-Bold", "New York"]
    ]
  ]
  let weights = fontNames[selectedFamily] ?? fontNames["Manrope"]!
  let names = weights[weight ?? "regular"] ?? weights["regular"]!
  for name in names {
    if let font = NSFont(name: name, size: size) {
      return font
    }
  }
  return NSFont.systemFont(ofSize: size, weight: .regular)
}

@Sendable func textAlignment(_ value: String?) -> NSTextAlignment {
  switch value {
  case "left": return .left
  case "right": return .right
  default: return .center
  }
}

@Sendable func textAttributes(_ layer: Layer, fontSize: CGFloat, paragraph: NSParagraphStyle, color: NSColor) -> [NSAttributedString.Key: Any] {
  [
    .font: brandFont(size: fontSize, family: layer.fontFamily, weight: layer.weight),
    .foregroundColor: color,
    .paragraphStyle: paragraph
  ]
}

@Sendable func wrapLines(_ text: String, width: CGFloat, attributes: [NSAttributedString.Key: Any]) -> [String] {
  var lines: [String] = []
  text.components(separatedBy: "\n").forEach { part in
    var line = ""
    part.split { $0 == " " || $0 == "\t" }.forEach { piece in
      let word = String(piece)
      let test = line.isEmpty ? word : "\(line) \(word)"
      let size = NSString(string: test).size(withAttributes: attributes)
      if size.width > width && !line.isEmpty {
        lines.append(line)
        line = word
      } else {
        line = test
      }
    }
    if !line.isEmpty { lines.append(line) }
  }
  return lines.isEmpty ? [""] : lines
}

@Sendable func drawText(_ layer: Layer, context: CGContext) {
  let paragraph = NSMutableParagraphStyle()
  paragraph.alignment = textAlignment(layer.align)
  paragraph.lineBreakMode = .byWordWrapping
  let alpha = CGFloat(layer.opacity ?? 1)
  let color = parseColor(layer.color, fallback: .white).withAlphaComponent(alpha)
  let rect = CGRect(
    x: layer.x + (layer.paddingX ?? 0),
    y: Double(height) - layer.y - layer.height + (layer.paddingY ?? 0),
    width: max(1, layer.width - ((layer.paddingX ?? 0) * 2)),
    height: max(1, layer.height - ((layer.paddingY ?? 0) * 2))
  )

  let requestedSize = CGFloat(layer.fontSize ?? 32)
  let minFontSize = min(requestedSize, 18)
  var fontSize = requestedSize
  var lineHeight = fontSize * CGFloat(layer.lineHeight ?? 1.08)
  var attrs = textAttributes(layer, fontSize: fontSize, paragraph: paragraph, color: color)
  var lines = wrapLines(layer.text ?? "", width: rect.width, attributes: attrs)

  while fontSize > minFontSize && CGFloat(lines.count) * lineHeight > rect.height {
    fontSize -= 1
    lineHeight = fontSize * CGFloat(layer.lineHeight ?? 1.08)
    attrs = textAttributes(layer, fontSize: fontSize, paragraph: paragraph, color: color)
    lines = wrapLines(layer.text ?? "", width: rect.width, attributes: attrs)
  }

  let blockHeight = CGFloat(lines.count) * lineHeight
  var y = rect.midY + blockHeight / 2 - lineHeight * 0.82
  NSGraphicsContext.saveGraphicsState()
  NSGraphicsContext.current = NSGraphicsContext(cgContext: context, flipped: false)
  for line in lines {
    let lineSize = NSString(string: line).size(withAttributes: attrs)
    let x: CGFloat
    switch layer.align {
    case "left": x = rect.minX
    case "right": x = rect.maxX - lineSize.width
    default: x = rect.midX - lineSize.width / 2
    }
    NSString(string: line).draw(at: CGPoint(x: x, y: y), withAttributes: attrs)
    y -= lineHeight
  }
  NSGraphicsContext.restoreGraphicsState()
}

@Sendable func drawSingleLine(_ text: String, rect: CGRect, layer: Layer, context: CGContext) {
  let alpha = CGFloat(layer.opacity ?? 1)
  let color = parseColor(layer.color, fallback: .white).withAlphaComponent(alpha)
  let attrs: [NSAttributedString.Key: Any] = [
    .font: brandFont(size: CGFloat(layer.fontSize ?? 28), family: layer.fontFamily, weight: layer.weight),
    .foregroundColor: color
  ]
  let size = NSString(string: text).size(withAttributes: attrs)
  let point = CGPoint(
    x: rect.midX - size.width / 2,
    y: rect.midY - size.height / 2 - 2 + CGFloat(layer.paddingY ?? 0) * 0.05
  )
  NSGraphicsContext.saveGraphicsState()
  NSGraphicsContext.current = NSGraphicsContext(cgContext: context, flipped: false)
  NSString(string: text).draw(at: point, withAttributes: attrs)
  NSGraphicsContext.restoreGraphicsState()
}

@Sendable func drawImageCover(_ image: NSImage, rect: CGRect, context: CGContext, alpha: CGFloat = 1) {
  guard let cgImage = image.cgImage(forProposedRect: nil, context: nil, hints: nil) else { return }
  let imageSize = CGSize(width: cgImage.width, height: cgImage.height)
  let scale = max(rect.width / imageSize.width, rect.height / imageSize.height)
  let drawSize = CGSize(width: imageSize.width * scale, height: imageSize.height * scale)
  let drawRect = CGRect(
    x: rect.midX - drawSize.width / 2,
    y: rect.midY - drawSize.height / 2,
    width: drawSize.width,
    height: drawSize.height
  )
  context.saveGState()
  context.setAlpha(alpha)
  context.draw(cgImage, in: drawRect)
  context.restoreGState()
}

@Sendable func drawCGImageCover(_ image: CGImage, rect: CGRect, context: CGContext, alpha: CGFloat = 1) {
  let imageSize = CGSize(width: image.width, height: image.height)
  let scale = max(rect.width / imageSize.width, rect.height / imageSize.height)
  let drawSize = CGSize(width: imageSize.width * scale, height: imageSize.height * scale)
  let drawRect = CGRect(
    x: rect.midX - drawSize.width / 2,
    y: rect.midY - drawSize.height / 2,
    width: drawSize.width,
    height: drawSize.height
  )
  context.saveGState()
  context.setAlpha(alpha)
  context.draw(image, in: drawRect)
  context.restoreGState()
}

@Sendable func drawImageFit(_ image: NSImage, rect: CGRect, context: CGContext, alpha: CGFloat = 1) {
  guard let cgImage = image.cgImage(forProposedRect: nil, context: nil, hints: nil) else { return }
  context.saveGState()
  context.setAlpha(alpha)
  context.draw(cgImage, in: rect)
  context.restoreGState()
}

@Sendable func backgroundMotion(_ scene: Scene, time: Double) -> (x: CGFloat, y: CGFloat, zoom: CGFloat) {
  let bg = scene.background
  let animation = bg?.animation
  guard animation?.type == "kenBurns" else {
    return (
      CGFloat(bg?.x ?? 0),
      CGFloat(bg?.y ?? 0),
      CGFloat(bg?.zoom ?? 1)
    )
  }
  let duration = max(0.1, scene.end - scene.start)
  let progress = smoothstep(CGFloat((time - scene.start) / duration))
  let baseX = CGFloat(bg?.x ?? 0)
  let baseY = CGFloat(bg?.y ?? 0)
  let baseZoom = CGFloat(bg?.zoom ?? 1)
  return (
    lerp(CGFloat(animation?.startX ?? Double(baseX)), CGFloat(animation?.endX ?? Double(baseX)), progress),
    lerp(CGFloat(animation?.startY ?? Double(baseY)), CGFloat(animation?.endY ?? Double(baseY)), progress),
    lerp(CGFloat(animation?.startZoom ?? Double(baseZoom)), CGFloat(animation?.endZoom ?? Double(baseZoom)), progress)
  )
}

@Sendable func drawBackground(_ scene: Scene, time: Double, context: CGContext) {
  let w = CGFloat(width)
  let h = CGFloat(height)
  context.setFillColor(parseColor(config.theme.backgroundColor, fallback: NSColor(red: 0.043, green: 0.008, blue: 0.082, alpha: 1)).cgColor)
  context.fill(CGRect(x: 0, y: 0, width: w, height: h))

  let bgPath = scene.background?.image ?? config.assets.background
  let motion = backgroundMotion(scene, time: time)
  let rect = CGRect(
    x: motion.x,
    y: motion.y,
    width: w * motion.zoom,
    height: h * motion.zoom
  )
  let localTime = max(0, time - scene.start)
  if let video = loadVideoBackground(bgPath), let frame = frameForVideoBackground(video, time: localTime) {
    drawCGImageCover(frame, rect: rect, context: context)
  } else if let animated = loadAnimatedImage(bgPath) {
    drawCGImageCover(frameForAnimatedImage(animated, time: localTime), rect: rect, context: context)
  } else if let image = loadImage(bgPath) {
    drawImageCover(image, rect: rect, context: context)
  }

  let gradient = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(), colors: [
    parseColor(config.theme.overlayTop, fallback: NSColor(red: 0.043, green: 0.008, blue: 0.082, alpha: 0.56)).cgColor,
    parseColor(config.theme.overlayMid, fallback: NSColor(red: 0.043, green: 0.008, blue: 0.082, alpha: 0.76)).cgColor,
    parseColor(config.theme.overlayBottom, fallback: NSColor(red: 0.043, green: 0.008, blue: 0.082, alpha: 0.95)).cgColor
  ] as CFArray, locations: [0, 0.5, 1])!
  context.drawLinearGradient(gradient, start: CGPoint(x: w / 2, y: h), end: CGPoint(x: w / 2, y: 0), options: [])

  context.setFillColor(NSColor(red: 0.61, green: 0.17, blue: 0.60, alpha: 0.24).cgColor)
  context.fillEllipse(in: CGRect(x: -258, y: 1240, width: 660, height: 660))
  context.setFillColor(NSColor(red: 0.49, green: 0.23, blue: 0.93, alpha: 0.20).cgColor)
  context.fillEllipse(in: CGRect(x: 700, y: 210, width: 620, height: 620))
}

@Sendable func drawLayer(_ layer: Layer, context: CGContext) {
  let alpha = CGFloat(layer.opacity ?? 1)
  let rect = CGRect(
    x: layer.x,
    y: Double(height) - layer.y - layer.height,
    width: layer.width,
    height: layer.height
  )

  if layer.type == "text" {
    drawText(layer, context: context)
    return
  }

  if layer.type == "image" {
    if let image = loadImage(layer.source) {
      drawImageFit(image, rect: rect, context: context, alpha: alpha)
    }
    return
  }

  if layer.type == "card" || layer.type == "pill" {
    context.saveGState()
    context.setAlpha(alpha)
    context.setFillColor(parseColor(layer.fill, fallback: NSColor(red: 0.035, green: 0.012, blue: 0.075, alpha: 0.72)).cgColor)
    context.addPath(roundedRectPath(rect, radius: CGFloat(layer.radius ?? layer.height / 2)))
    context.fillPath()
    context.setStrokeColor(parseColor(layer.stroke, fallback: NSColor.white.withAlphaComponent(0.18)).cgColor)
    context.setLineWidth(2)
    context.addPath(roundedRectPath(rect, radius: CGFloat(layer.radius ?? layer.height / 2)))
    context.strokePath()
    context.restoreGState()

    if layer.type == "pill" {
      drawText(layer, context: context)
    }
  }
}

@Sendable func sceneAt(_ time: Double) -> Scene {
  config.scenes.first { time >= $0.start && time < $0.end } ?? config.scenes.last!
}

@Sendable func drawScene(_ scene: Scene, time: Double, into buffer: CVPixelBuffer, alpha: CGFloat = 1, offset: CGPoint = .zero) {
  CVPixelBufferLockBaseAddress(buffer, [])
  defer { CVPixelBufferUnlockBaseAddress(buffer, []) }

  guard let baseAddress = CVPixelBufferGetBaseAddress(buffer) else { return }
  let bytesPerRow = CVPixelBufferGetBytesPerRow(buffer)
  guard let context = CGContext(
    data: baseAddress,
    width: width,
    height: height,
    bitsPerComponent: 8,
    bytesPerRow: bytesPerRow,
    space: CGColorSpaceCreateDeviceRGB(),
    bitmapInfo: CGImageAlphaInfo.noneSkipFirst.rawValue
  ) else { return }

  context.saveGState()
  context.setAlpha(alpha)
  context.translateBy(x: offset.x, y: offset.y)
  drawBackground(scene, time: time, context: context)
  scene.layers.forEach { drawLayer($0, context: context) }
  context.restoreGState()
}

@Sendable func clearBuffer(_ buffer: CVPixelBuffer) {
  CVPixelBufferLockBaseAddress(buffer, [])
  defer { CVPixelBufferUnlockBaseAddress(buffer, []) }
  guard let baseAddress = CVPixelBufferGetBaseAddress(buffer) else { return }
  let bytesPerRow = CVPixelBufferGetBytesPerRow(buffer)
  guard let context = CGContext(
    data: baseAddress,
    width: width,
    height: height,
    bitsPerComponent: 8,
    bytesPerRow: bytesPerRow,
    space: CGColorSpaceCreateDeviceRGB(),
    bitmapInfo: CGImageAlphaInfo.noneSkipFirst.rawValue
  ) else { return }
  context.setFillColor(parseColor(config.theme.backgroundColor, fallback: .black).cgColor)
  context.fill(CGRect(x: 0, y: 0, width: width, height: height))
}

func drawFrame(time: Double, into buffer: CVPixelBuffer) {
  clearBuffer(buffer)
  let scene = sceneAt(time)
  guard let index = config.scenes.firstIndex(where: { $0.id == scene.id }) else {
    drawScene(scene, time: time, into: buffer)
    return
  }

  let transitionType = scene.transition?.type ?? "none"
  let transitionDuration = transitionType == "none" ? 0 : max(0, scene.transition?.duration ?? 0)
  let progress = transitionDuration > 0 ? clamp(CGFloat((time - scene.start) / transitionDuration)) : 1

  if index > 0 && transitionDuration > 0 && progress < 1 {
    let previous = config.scenes[index - 1]
    let previousTime = max(previous.start, scene.start - 0.01)
    if transitionType == "crossfade" || transitionType == "fade" {
      drawScene(previous, time: previousTime, into: buffer, alpha: 1 - progress)
      drawScene(scene, time: time, into: buffer, alpha: progress)
      return
    }
    if transitionType == "slide-up" {
      drawScene(previous, time: previousTime, into: buffer, alpha: 1, offset: CGPoint(x: 0, y: -CGFloat(height) * progress))
      drawScene(scene, time: time, into: buffer, alpha: 1, offset: CGPoint(x: 0, y: CGFloat(height) * (1 - progress)))
      return
    }
    if transitionType == "slide-left" {
      drawScene(previous, time: previousTime, into: buffer, alpha: 1, offset: CGPoint(x: -CGFloat(width) * progress, y: 0))
      drawScene(scene, time: time, into: buffer, alpha: 1, offset: CGPoint(x: CGFloat(width) * (1 - progress), y: 0))
      return
    }
  }

  drawScene(scene, time: time, into: buffer)
}

func makePixelBuffer() -> CVPixelBuffer {
  var pixelBuffer: CVPixelBuffer?
  let status = CVPixelBufferPoolCreatePixelBuffer(nil, adaptor.pixelBufferPool!, &pixelBuffer)
  guard status == kCVReturnSuccess, let buffer = pixelBuffer else {
    fatalError("Could not allocate pixel buffer.")
  }
  return buffer
}

func makeStandalonePixelBuffer() -> CVPixelBuffer {
  var pixelBuffer: CVPixelBuffer?
  let status = CVPixelBufferCreate(
    kCFAllocatorDefault,
    width,
    height,
    kCVPixelFormatType_32ARGB,
    [
      kCVPixelBufferCGImageCompatibilityKey: true,
      kCVPixelBufferCGBitmapContextCompatibilityKey: true
    ] as CFDictionary,
    &pixelBuffer
  )
  guard status == kCVReturnSuccess, let buffer = pixelBuffer else {
    fatalError("Could not allocate standalone pixel buffer.")
  }
  return buffer
}

func cgImageFromBuffer(_ buffer: CVPixelBuffer) -> CGImage? {
  CVPixelBufferLockBaseAddress(buffer, .readOnly)
  defer { CVPixelBufferUnlockBaseAddress(buffer, .readOnly) }
  guard let baseAddress = CVPixelBufferGetBaseAddress(buffer) else { return nil }
  let bytesPerRow = CVPixelBufferGetBytesPerRow(buffer)
  guard let context = CGContext(
    data: baseAddress,
    width: width,
    height: height,
    bitsPerComponent: 8,
    bytesPerRow: bytesPerRow,
    space: CGColorSpaceCreateDeviceRGB(),
    bitmapInfo: CGImageAlphaInfo.noneSkipFirst.rawValue
  ) else { return nil }
  return context.makeImage()
}

func writePNG(_ image: CGImage, to url: URL) {
  guard let destination = CGImageDestinationCreateWithURL(url as CFURL, UTType.png.identifier as CFString, 1, nil) else {
    return
  }
  CGImageDestinationAddImage(destination, image, nil)
  CGImageDestinationFinalize(destination)
}

writer.startWriting()
writer.startSession(atSourceTime: .zero)

let mediaQueue = DispatchQueue(label: "bible-paddy-video-dashboard-render")
let group = DispatchGroup()
group.enter()

var frameIndex = 0
input.requestMediaDataWhenReady(on: mediaQueue) {
  while input.isReadyForMoreMediaData && frameIndex < totalFrames {
    let buffer = makePixelBuffer()
    let time = Double(frameIndex) / Double(fps)
    drawFrame(time: time, into: buffer)
    let presentationTime = CMTime(value: CMTimeValue(frameIndex), timescale: CMTimeScale(fps))
    adaptor.append(buffer, withPresentationTime: presentationTime)
    frameIndex += 1
  }

  if frameIndex >= totalFrames {
    input.markAsFinished()
    writer.finishWriting {
      group.leave()
    }
  }
}

group.wait()

if writer.status == .failed {
  fatalError("Render failed: \(writer.error?.localizedDescription ?? "unknown error")")
}

let coverScene = config.scenes.first { $0.id == config.coverSceneId } ?? config.scenes[0]
let coverBuffer = makeStandalonePixelBuffer()
drawScene(coverScene, time: coverScene.start, into: coverBuffer)
if let coverImage = cgImageFromBuffer(coverBuffer) {
  writePNG(coverImage, to: coverURL)
}

print("Rendered \(outputURL.path)")
print("Rendered \(coverURL.path)")
