// Server Component — generateStaticParams() must live here (not in 'use client' files).
//
// We return a placeholder entry because Next.js static export requires at least
// one path from generateStaticParams(). Real slugs are created dynamically at
// runtime and are unknown at build time. CloudFront's 404→index.html fallback
// serves the app shell for any slug, and the client component fetches data from
// the API using the slug from the URL.
import StatusPageClient from './status-page-client';

export function generateStaticParams() {
  return [{ slug: '__placeholder__' }];
}

export default function StatusPage({ params }: { params: { slug: string } }) {
  return <StatusPageClient params={params} />;
}
