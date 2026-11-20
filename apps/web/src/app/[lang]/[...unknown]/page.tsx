import { notFound } from 'next/navigation';

/** Any other address under a language: the 404 page inside the site's layout, not the framework's bare one. */
export default function UnknownPage(): never {
  notFound();
}
