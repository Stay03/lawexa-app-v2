import { redirect } from 'next/navigation';

/** `/admin/certificates` opens on the designs. */
export default function AdminCertificatesPage() {
  redirect('/admin/certificates/templates');
}
