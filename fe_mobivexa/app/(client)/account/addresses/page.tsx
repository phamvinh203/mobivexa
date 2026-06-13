import { PagePlaceholder } from '@/components/ui/page-placeholder'

export default function AddressesPage() {
  return (
    <PagePlaceholder
      title="Địa chỉ của tôi"
      endpoint="GET /users/me/addresses · userApi.listAddresses()"
      todos={[
        'Lưới card địa chỉ + nhãn mặc định',
        'Thêm/sửa (createAddress/updateAddress), xoá, đặt mặc định',
      ]}
    />
  )
}
