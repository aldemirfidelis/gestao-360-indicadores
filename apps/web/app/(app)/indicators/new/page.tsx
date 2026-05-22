import { redirect } from 'next/navigation';

export default function NewIndicatorPage() {
  redirect('/indicators?new=1');
}
