import { redirect } from 'next/navigation';

export default function CheckoutRootPage() {
  redirect('/landing/checkout/items');
}
