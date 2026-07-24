import type { Metadata } from 'next'
import { AddressBook } from './_components/address-book'

export const metadata: Metadata = {
  title: 'Địa chỉ của tôi · Mobivexa',
}

export default function AddressesPage() {
  return <AddressBook />
}
