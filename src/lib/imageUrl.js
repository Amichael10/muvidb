export function getProxiedImageUrl(originalUrl) {
  if (!originalUrl) return originalUrl;
  
  // Replace Supabase URL with our own domain's reverse proxy path
  // from: https://pkenrmorywmuvnzfoylp.supabase.co/storage/v1/object/public/posters/b2b...
  // to: /storage/v1/object/public/posters/b2b...
  const supabaseDomain = 'https://pkenrmorywmuvnzfoylp.supabase.co';
  
  if (originalUrl.startsWith(supabaseDomain)) {
    return originalUrl.replace(supabaseDomain, ''); // Returns the relative path which Vercel proxies
  }
  
  return originalUrl;
}
