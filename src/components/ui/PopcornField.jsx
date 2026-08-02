const POPCORN_KERNELS = [
  { src: '/assets/popcorn/popcorn-01.svg', x: '6%', size: '24px', drift: '42px', duration: '24s', delay: '-2s', tilt: '-12deg' },
  { src: '/assets/popcorn/popcorn-07.svg', x: '18%', size: '19px', drift: '-30px', duration: '30s', delay: '-18s', tilt: '18deg' },
  { src: '/assets/popcorn/popcorn-03.svg', x: '31%', size: '27px', drift: '34px', duration: '27s', delay: '-9s', tilt: '9deg' },
  { src: '/assets/popcorn/popcorn-13.svg', x: '44%', size: '18px', drift: '-44px', duration: '34s', delay: '-26s', tilt: '-24deg' },
  { src: '/assets/popcorn/popcorn-05.svg', x: '57%', size: '25px', drift: '26px', duration: '25s', delay: '-5s', tilt: '15deg' },
  { src: '/assets/popcorn/popcorn-12.svg', x: '68%', size: '20px', drift: '-22px', duration: '33s', delay: '-22s', tilt: '-8deg' },
  { src: '/assets/popcorn/popcorn-02.svg', x: '79%', size: '29px', drift: '48px', duration: '28s', delay: '-13s', tilt: '26deg' },
  { src: '/assets/popcorn/popcorn-10.svg', x: '90%', size: '18px', drift: '-38px', duration: '35s', delay: '-30s', tilt: '-16deg' },
  { src: '/assets/popcorn/popcorn-15.svg', x: '12%', size: '27px', drift: '24px', duration: '31s', delay: '-24s', tilt: '12deg' },
  { src: '/assets/popcorn/popcorn-04.svg', x: '72%', size: '22px', drift: '-46px', duration: '32s', delay: '-8s', tilt: '-20deg' },
];

export default function PopcornField() {
  return (
    <div className="muvi-popcorn-field" aria-hidden="true">
      {POPCORN_KERNELS.map((kernel, index) => (
        <span
          key={`${kernel.x}-${index}`}
          className="muvi-popcorn-kernel"
          style={{
            '--x': kernel.x,
            '--kernel-size': kernel.size,
            '--drift': kernel.drift,
            '--duration': kernel.duration,
            '--delay': kernel.delay,
            '--tilt': kernel.tilt,
          }}
        >
          <img src={kernel.src} alt="" draggable="false" />
        </span>
      ))}
    </div>
  );
}
