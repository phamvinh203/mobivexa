# Tài Liệu TestCase - Module Đánh Giá (Review)

## Tổng Quan
Module Đánh Giá cho phép người dùng đánh giá sản phẩm đã mua, quản lý đánh giá cá nhân, và quản trị viên phản hồi đánh giá. Bài viết này bao gồm 51 test case chia làm 6 loại chính: Unit Tests, Integration Tests, E2E Tests, Edge Cases, Security Tests, và Performance Tests.

---

## 1. Unit Tests (10 Tests)

### UT-01: Validation - Rating (1-5, Integer)
- **Mô tả**: Kiểm tra validation đánh giá phải là số nguyên từ 1-5
- **Tiền điều kiện**: Validator đã được khởi tạo
- **Bước thực hiện**:
  1. Gọi validateRating với giá trị 1, 2, 3, 4, 5
  2. Gọi validateRating với giá trị 0, 6, -1, 5.5, "abc"
- **Kết quả mong đợi**:
  - Giá trị 1-5: return true
  - Giá trị khác: return false với thông báo lỗi
- **Độ ưu tiên**: High
- **Loại**: Positive/Negative

### UT-02: Validation - Content Length (10-2000 chars)
- **Mô tả**: Kiểm tra validation nội dung đánh giá phải từ 10-2000 ký tự
- **Tiền điều kiện**: Validator đã được khởi tạo
- **Bước thực hiện**:
  1. Gọi validateContent với chuỗi 9 ký tự
  2. Gọi validateContent với chuỗi 10 ký tự
  3. Gọi validateContent với chuỗi 2000 ký tự
  4. Gọi validateContent với chuỗi 2001 ký tự
  5. Gọi validateContent với chuỗi rỗng
- **Kết quả mong đợi**:
  - 10-2000 ký tự: return true
  - <10 hoặc >2000 ký tự: return false với thông báo lỗi
- **Độ ưu tiên**: High
- **Loại**: Positive/Negative

### UT-03: Business Logic - 30-Day Window Check
- **Mô tả**: Kiểm tra logic giới hạn chỉnh sửa đánh giá trong 30 ngày
- **Tiền điều kiện**: Review đã tồn tại với createdAt = 29 ngày trước và 31 ngày trước
- **Bước thực hiện**:
  1. Tạo review với createdAt = 29 ngày trước
  2. Gọi updateReview với reviewId ở bước 1
  3. Tạo review với createdAt = 31 ngày trước
  4. Gọi updateReview với reviewId ở bước 3
- **Kết quả mong đợi**:
  - 29 ngày: update thành công
  - 31 ngày: throw AppError(400, 'Đã quá 30 ngày, không thể chỉnh sửa đánh giá')
- **Độ ưu tiên**: High
- **Loại**: Positive/Negative

### UT-04: Business Logic - Photo Upload Limit (Max 5)
- **Mô tả**: Kiểm tra giới hạn upload tối đa 5 photos
- **Tiền điều kiện**: Upload middleware đã được cấu hình
- **Bước thực hiện**:
  1. Upload 5 files ảnh hợp lệ
  2. Upload 6 files ảnh hợp lệ
- **Kết quả mong đợi**:
  - 5 files: tất cả được upload
  - 6 files: chỉ 5 files đầu tiên được upload, file thứ 6 bị bỏ qua
- **Độ ưu tiên**: Medium
- **Loại**: Positive/Edge

### UT-05: Helper - Review Photo URL Generation
- **Mô tả**: Kiểm tra logic tạo URL photo đánh giá
- **Tiền điều kiện**: Cloudinary đã được mock
- **Bước thực hiện**:
  1. Upload file ảnh qua uploadEntityImage
  2. Kiểm tra cấu trúc URL trả về
- **Kết quả mong đợi**:
  - URL trả về có format: https://cdn/[folder]/[publicId]
  - PublicId được lưu để dùng cho xóa sau này
- **Độ ưu tiên**: Medium
- **Loại**: Positive

### UT-06: Business Logic - Helpful Toggle Logic
- **Mô tả**: Kiểm tra logic toggle helpful (create/remove vote)
- **Tiền điều kiện**: User và review đã tồn tại
- **Bước thực hiện**:
  1. Gọi toggleHelpful khi user chưa vote
  2. Gọi toggleHelpful lần 2 (đã vote)
  3. Gọi toggleHelpful lần 3 (bỏ vote)
- **Kết quả mong đợi**:
  - Lần 1: tạo vote mới, return { helpful: true, count: 1 }
  - Lần 2: xóa vote, return { helpful: false, count: 0 }
  - Lần 3: tạo vote mới, return { helpful: true, count: 1 }
- **Độ ưu tiên**: High
- **Loại**: Positive

### UT-07: Helper - Average Rating Calculation (1 decimal)
- **Mô tả**: Kiểm tra tính toán đánh giá trung bình làm tròn 1 chữ số thập phân
- **Tiền điều kiện**: Database có các review với rating: 4, 5, 3, 4, 5
- **Bước thực hiện**:
  1. Gọi getReviewSummary với slug sản phẩm
  2. Tính thủ công: (4+5+3+4+5)/5 = 4.2
- **Kết quả mong đợi**:
  - averageRating = 4.2 (không phải 4.166666...)
  - Sử dụng toFixed(1) cho kết quả
- **Độ ưu tiên**: Medium
- **Loại**: Positive

### UT-08: Helper - Breakdown Aggregation (1-5 stars)
- **Mô tả**: Kiểm tra tổng hợp phân phối đánh giá theo sao
- **Tiền điều kiện**: Database có 7 review 5-sao, 3 review 4-sao
- **Bước thực hiện**:
  1. Gọi getReviewSummary
  2. Kiểm tra breakdown object
- **Kết quả mong đợi**:
  - breakdown = { 1: 0, 2: 0, 3: 0, 4: 3, 5: 7 }
  - Tất cả 5 level đều có key, missing level = 0
- **Độ ưu tiên**: Medium
- **Loại**: Positive

### UT-09: Database Constraint - Unique (userId, reviewId) for Helpful
- **Mô tả**: Kiểm tra ràng buộc unique trên reviewHelpful
- **Tiền điều kiện**: Database đã tạo reviewHelpful với (userId, reviewId)
- **Bước thực hiện**:
  1. Tạo reviewHelpful với (userId='user-1', reviewId='review-1')
  2. Tạo reviewHelpful lần 2 với cùng cặp
- **Kết quả mong đợi**:
  - Lần 1: tạo thành công
  - Lần 2: throw Prisma error với code='P2002' (unique constraint)
- **Độ ưu tiên**: High
- **Loại**: Negative

### UT-10: Business Logic - ProductId Resolution (variantId fallback)
- **Mô tả**: Kiểm tra logic xác định productId từ variantId hoặc orderItem
- **Tiền điều kiện**: 
  - Case 1: orderItem có variantId → variant có productId
  - Case 2: orderItem không có variantId → cần lookup từ productName/sku
- **Bước thực hiện**:
  1. Tạo review với variantId hợp lệ
  2. Tạo review với variantId null, sku hợp lệ
  3. Tạo review với variantId null, productName hợp lệ
- **Kết quả mong đợi**:
  - Case 1: productId từ variant.productId
  - Case 2: productId từ variant.sku lookup
  - Case 3: productId từ product.name lookup
  - Case không tìm thấy: throw AppError(400, 'Không xác định được sản phẩm')
- **Độ ưu tiên**: High
- **Loại**: Positive/Edge

---

## 2. Integration Tests (12 Tests)

### IT-01: API - Get Review Summary (Valid Product)
- **Mô tả**: Lấy tổng hợp đánh giá của sản phẩm hợp lệ
- **Tiền điều kiện**: Product với slug='iphone-15' đã tồn tại, có 10 review APPROVED
- **Bước thực hiện**:
  1. Gửi GET /api/products/iphone-15/reviews/summary
  2. Verify response
- **Kết quả mong đợi**:
  - Status: 200
  - Body: { averageRating: 4.5, totalCount: 10, breakdown: {...}, withPhotoCount: 5 }
- **Độ ưu tiên**: High
- **Loại**: Positive

### IT-02: API - List Reviews (With Filters)
- **Mô tả**: Liệt kê đánh giá với bộ lọc rating, hasPhoto, sort
- **Tiền điều kiện**: Product slug='iphone-15' có nhiều review
- **Bước thực hiện**:
  1. GET /api/products/iphone-15/reviews?rating=5
  2. GET /api/products/iphone-15/reviews?hasPhoto=true
  3. GET /api/products/iphone-15/reviews?sort=helpful
  4. GET /api/products/iphone-15/reviews?page=1&limit=10
- **Kết quả mong đợi**:
  - rating=5: chỉ trả về review 5-sao
  - hasPhoto=true: chỉ trả về review có photos
  - sort=helpful: sắp xếp theo helpful count DESC
  - page/limit: pagination hoạt động đúng
- **Độ ưu tiên**: High
- **Loại**: Positive

### IT-03: API - Get Pending Reviews (Authenticated User)
- **Mô tả**: Lấy danh sách đơn hàng chờ đánh giá của user
- **Tiền điều kiện**: 
  - User đã login, có userId='user-1'
  - User có order DELIVERED mà chưa review
- **Bước thực hiện**:
  1. Gửi GET /api/users/me/reviews/pending với Authorization header
  2. Verify response
- **Kết quả mong đợi**:
  - Status: 200
  - Body: array của orderItems (id, productName, sku, order, variant.product.images...)
  - Chỉ trả về đơn DELIVERED chưa có review
- **Độ ưu tiên**: High
- **Loại**: Positive

### IT-04: API - Create Review (Valid DELIVERED Order)
- **Mô tả**: Tạo đánh giá cho sản phẩm từ đơn hàng đã giao
- **Tiền điều kiện**: 
  - User đã login
  - orderItemId='item-1' thuộc order DELIVERED, chưa có review
- **Bước thực hiện**:
  1. Gửi POST /api/order-items/item-1/review
  2. Body: { rating: 5, content: 'Sản phẩm rất tốt, chất lượng xuất sắc!' }
  3. Attach 3 files ảnh (optional)
- **Kết quả mong đợi**:
  - Status: 201
  - Body: review object mới tạo với photos array
  - Database: review được tạo với status='APPROVED'
- **Độ ưu tiên**: High
- **Loại**: Positive

### IT-05: API - Create Review (Already Exists - 409)
- **Mô tả**: Tạo đánh giá khi đã đánh giá rồi
- **Tiền điều kiện**: 
  - orderItemId='item-1' đã có review
- **Bước thực hiện**:
  1. Gửi POST /api/order-items/item-1/review
  2. Body: { rating: 4, content: 'Đánh giá thứ hai' }
- **Kết quả mong đợi**:
  - Status: 409
  - Body: { message: 'Bạn đã đánh giá sản phẩm này rồi' }
- **Độ ưu tiên**: High
- **Loại**: Negative

### IT-06: API - Create Review (Order Not DELIVERED - 404)
- **Mô tả**: Tạo đánh giá cho đơn hàng không phải DELIVERED
- **Tiền điều kiện**: 
  - orderItemId='item-2' thuộc order PENDING/SHIPPED
- **Bước thực hiện**:
  1. Gửi POST /api/order-items/item-2/review
  2. Body: { rating: 5, content: 'Test' }
- **Kết quả mong đợi**:
  - Status: 404
  - Body: { message: 'Không tìm thấy sản phẩm trong đơn hàng đã giao' }
- **Độ ưu tiên**: High
- **Loại**: Negative

### IT-07: API - Update Review (Within 30-Day Window)
- **Mô tả**: Chỉnh sửa đánh giá trong vòng 30 ngày
- **Tiền điều kiện**: 
  - User đã login
  - reviewId='review-1' thuộc user này, createdAt = 5 ngày trước
- **Bước thực hiện**:
  1. Gửi PUT /api/reviews/review-1
  2. Body: { rating: 4, content: 'Cập nhật: Sản phẩm tốt hơn tôi nghĩ' }
- **Kết quả mong đợi**:
  - Status: 200
  - Body: review object đã update
  - Database: review được cập nhật rating và content
- **Độ ưu tiên**: High
- **Loại**: Positive

### IT-08: API - Update Review (After 30-Day Window - 400)
- **Mô tả**: Chỉnh sửa đánh giá sau 30 ngày
- **Tiền điều kiện**: 
  - reviewId='review-2' có createdAt = 31 ngày trước
- **Bước thực hiện**:
  1. Gửi PUT /api/reviews/review-2
  2. Body: { content: 'Cố gắng update sau 30 ngày' }
- **Kết quả mong đợi**:
  - Status: 400
  - Body: { message: 'Đã quá 30 ngày, không thể chỉnh sửa đánh giá' }
- **Độ ưu tiên**: High
- **Loại**: Negative

### IT-09: API - Delete Review (Ownership Check)
- **Mô tả**: Xóa đánh giá của chính mình
- **Tiền điều kiện**: 
  - User đã login
  - reviewId='review-3' thuộc user này
- **Bước thực hiện**:
  1. Gửi DELETE /api/reviews/review-3
- **Kết quả mong đợi**:
  - Status: 204
  - Database: review đã bị xóa, photos đã xóa khỏi Cloudinary
- **Độ ưu tiên**: High
- **Loại**: Positive

### IT-10: API - Toggle Helpful (Create New Vote)
- **Mô tả**: Đánh dấu helpful cho review (chưa vote)
- **Tiền điều kiện**: 
  - User đã login
  - reviewId='review-4' có status='APPROVED'
  - User chưa vote helpful cho review này
- **Bước thực hiện**:
  1. Gửi POST /api/reviews/review-4/helpful
- **Kết quả mong đợi**:
  - Status: 200
  - Body: { helpful: true, count: 1 }
  - Database: reviewHelpful được tạo
- **Độ ưu tiên**: High
- **Loại**: Positive

### IT-11: API - Toggle Helpful (Remove Existing Vote)
- **Mô tả**: Bỏ đánh dấu helpful (đã vote)
- **Tiền điều kiện**: 
  - User đã vote helpful cho reviewId='review-5'
- **Bước thực hiện**:
  1. Gửi POST /api/reviews/review-5/helpful
- **Kết quả mong đợi**:
  - Status: 200
  - Body: { helpful: false, count: 0 }
  - Database: reviewHelpful bị xóa
- **Độ ưu tiên**: High
- **Loại**: Positive

### IT-12: API - Admin Reply Review (Valid Content)
- **Mô tả**: Admin phản hồi đánh giá
- **Tiền điều kiện**: 
  - Admin đã login (role ADMIN/STAFF)
  - reviewId='review-6' đã tồn tại
- **Bước thực hiện**:
  1. Gửi POST /api/admin/reviews/review-6/reply
  2. Body: { content: 'Cảm ơn bạn đã đánh giá sản phẩm!' }
- **Kết quả mong đợi**:
  - Status: 200
  - Body: review object với replyContent và repliedAt
  - Database: review được cập nhật replyContent và repliedAt
- **Độ ưu tiên**: High
- **Loại**: Positive

---

## 3. E2E Tests (7 Tests)

### E2E-01: Complete Review Flow
- **Mô tả**: Luồng hoàn chỉnh từ xem pending → tạo đánh giá → xem kết quả
- **Tiền điều kiện**: 
  - User đã đăng ký và login
  - User có đơn hàng DELIVERED chưa đánh giá
- **Bước thực hiện**:
  1. User truy cập trang "Đơn hàng cần đánh giá"
  2. User chọn sản phẩm để đánh giá
  3. User nhập rating=5, content="Sản phẩm rất tốt"
  4. User upload 2 ảnh
  5. User submit form
  6. User truy cập trang sản phẩm
  7. User xem review vừa tạo trong danh sách
- **Kết quả mong đợi**:
  - Bước 1-2: Hiển thị danh sách orderItems đúng
  - Bước 3-4: Form validation hoạt động
  - Bước 5: Review được tạo, redirect về trang "Đánh giá của tôi"
  - Bước 6-7: Review hiển thị trong danh sách public, photos load đúng
- **Độ ưu tiên**: High
- **Loại**: Positive

### E2E-02: Edit Review Flow
- **Mô tả**: Luồng chỉnh sửa đánh giá
- **Tiền điều kiện**: 
  - User đã có review tạo được 5 ngày trước
- **Bước thực hiện**:
  1. User truy cập "Đánh giá của tôi"
  2. User click "Chỉnh sửa" trên review
  3. User thay đổi rating từ 5→4, content="Sản phẩm tốt nhưng có thể tốt hơn"
  4. User upload thêm 1 ảnh mới
  5. User submit
  6. User verify review đã update
- **Kết quả mong đợi**:
  - Bước 1-2: Form edit hiển thị dữ liệu cũ
  - Bước 3-4: Validation hoạt động, upload ảnh thành công
  - Bước 5: Review được update, giữ lại photos cũ + thêm mới
  - Bước 6: Review hiển thị thông tin update, updatedAt thay đổi
- **Độ ưu tiên**: High
- **Loại**: Positive

### E2E-03: Photo Management Flow
- **Mô tả**: Quản lý photos trong review (tạo → update → delete)
- **Tiền điều kiện**: 
  - User có orderItem chưa đánh giá
- **Bước thực hiện**:
  1. User tạo review với 3 photos
  2. User verify 3 photos hiển thị
  3. User edit review, upload thêm 2 photos
  4. User verify total 5 photos (3 cũ + 2 mới)
  5. User edit review, không upload photo mới
  6. User verify photos cũ vẫn còn
  7. User delete review
  8. User verify photos đã xóa khỏi Cloudinary
- **Kết quả mong đợi**:
  - Bước 1-2: Upload và hiển thị 3 photos thành công
  - Bước 3-4: Replace photos: 3 cũ bị xóa, 5 mới được tạo
  - Bước 5-6: Không upload → giữ nguyên photos hiện tại
  - Bước 7-8: Xóa review → xóa photos trên Cloudinary
- **Độ ưu tiên**: Medium
- **Loại**: Positive

### E2E-04: Helpful Voting Flow
- **Mô tả**: Luồng vote helpful
- **Tiền điều kiện**: 
  - Product có review từ user khác
  - User đã login
- **Bước thực hiện**:
  1. User view product detail, xem review list
  2. User click "Hữu ích" trên review
  3. Verify count tăng từ 0→1, button active
  4. User click "Hữu ích" lần nữa
  5. Verify count giảm từ 1→0, button inactive
  6. User click "Hữu ích" lần 3
  7. Verify count tăng từ 0→1, button active
- **Kết quả mong đợi**:
  - Toggle hoạt động đúng qua 3 lần click
  - Count update real-time trên UI
  - Button style thay đổi theo trạng thái vote
- **Độ ưu tiên**: Medium
- **Loại**: Positive

### E2E-05: Admin Response Flow
- **Mô tả**: Luồng admin phản hồi review
- **Tiền điều kiện**: 
  - Customer đã tạo review
  - Admin đã login
- **Bước thực hiện**:
  1. Admin truy cập admin review list
  2. Admin click "Phản hồi" trên review
  3. Admin nhập replyContent="Cảm ơn đánh giá của bạn!"
  4. Admin submit
  5. Customer view product detail
  6. Customer xem admin reply dưới review
- **Kết quả mong đợi**:
  - Bước 1-2: Admin modal hiển thị đúng
  - Bước 3-4: Reply được tạo, hiển thị trong admin list
  - Bước 5-6: Customer thấy reply content + repliedAt
- **Độ ưu tiên**: High
- **Loại**: Positive

### E2E-06: Public Browse Flow
- **Mô tả**: Luồng người dùng công cộng xem review
- **Tiền điều kiện**: 
  - Product có nhiều review với varied ratings và photos
- **Bước thực hiện**:
  1. User (không login) truy cập product detail
  2. User xem review summary (average rating, breakdown)
  3. User click filter "5 sao" → chỉ review 5-sao hiển thị
  4. User click filter "Có hình" → chỉ review có photo hiển thị
  5. User click sort "Hữu ích nhất" → sắp xếp theo helpful count
  6. User click review để xem chi tiết (nếu có modal/detail page)
- **Kết quả mong đợi**:
  - Bước 1: Không cần login để xem review
  - Bước 2: Summary hiển thị đúng average và breakdown
  - Bước 3-5: Filter và sort hoạt động đúng
  - Bước 6: Review detail hiển thị đầy đủ thông tin
- **Độ ưu tiên**: Medium
- **Loại**: Positive

### E2E-07: Admin Delete Flow
- **Mô tả**: Luồng admin xóa review vi phạm
- **Tiền điều kiện**: 
  - Customer đã tạo review không phù hợp
  - Admin đã login
- **Bước thực hiện**:
  1. Admin truy cập admin review list
  2. Admin thấy review cần xóa
  3. Admin click "Xóa" với lý do "Nội dung không phù hợp"
  4. Admin confirm xóa
  5. Customer view product detail
  6. Customer verify review đã biến mất
  7. Customer view "Đánh giá của tôi"
  8. Customer verify review không còn trong list
- **Kết quả mong đợi**:
  - Bước 1-4: Admin xóa thành công
  - Bước 5-6: Review không hiển thị trong public list
  - Bước 7-8: Review không còn trong user's review list (hoặc status=REJECTED)
- **Độ ưu tiên**: High
- **Loại**: Positive

---

## 4. Edge Cases (12 Tests)

### EC-01: Rating Edge Cases (0, >5, Decimal, Negative)
- **Mô tả**: Test các giá trị rating bất hợp lệ
- **Bước thực hiện**:
  1. POST review với rating=0
  2. POST review với rating=6
  3. POST review với rating=5.5
  4. POST review với rating=-1
  5. POST review với rating="abc"
- **Kết quả mong đợi**:
  - Tất cả: Status 400 với message 'Đánh giá phải từ 1 đến 5 sao'
- **Độ ưu tiên**: High
- **Loại**: Negative

### EC-02: Content Edge Cases (Empty, <10, >2000)
- **Mô tả**: Test các giá trị content bất hợp lệ
- **Bước thực hiện**:
  1. POST review với content="" (empty string)
  2. POST review với content="123456789" (9 chars)
  3. POST review với content="A".repeat(2001) (2001 chars)
  4. POST review với content=null
  5. POST review với content=undefined
- **Kết quả mong đợi**:
  - Tất cả: Status 400 với message về độ dài content
- **Độ ưu tiên**: High
- **Loại**: Negative

### EC-03: Upload 6+ Photos (Should Reject or Truncate)
- **Mô tả**: Test upload quá số lượng photos cho phép
- **Bước thực hiện**:
  1. POST review với 6 files ảnh
  2. Verify kết quả
- **Kết quả mong đợi**:
  - Chỉ 5 photos đầu tiên được upload
  - Photo thứ 6 bị bỏ qua (không lỗi, chỉ truncate)
  - Database: review có 5 photos
- **Độ ưu tiên**: Medium
- **Loại**: Edge

### EC-04: Invalid Photo Formats (PDF, DOCX)
- **Mô tả**: Test upload file không phải ảnh
- **Bước thực hiện**:
  1. POST review với file .pdf
  2. POST review với file .docx
  3. POST review với file .exe
- **Kết quả mong đợi**:
  - Upload middleware từ chối với error về file type
  - Status 400 với message về định dạng file
- **Độ ưu tiên**: High
- **Loại**: Negative

### EC-05: Photo Size > 5MB
- **Mô tả**: Test upload ảnh quá lớn
- **Bước thực hiện**:
  1. POST review với file ảnh 6MB
  2. POST review với file ảnh 10MB
- **Kết quả mong đợi**:
  - Upload middleware từ chối với error về file size
  - Status 413 (Payload Too Large) hoặc 400
- **Độ ưu tiên**: Medium
- **Loại**: Negative

### EC-06: Non-DELIVERED Order Attempt
- **Mô tả**: Test review đơn hàng chưa giao
- **Bước thực hiện**:
  1. POST review cho orderItem với order.status=PENDING
  2. POST review cho orderItem với order.status=SHIPPED
  3. POST review cho orderItem với order.status=CANCELLED
- **Kết quả mong đợi**:
  - Tất cả: Status 404 với message 'Không tìm thấy sản phẩm trong đơn hàng đã giao'
- **Độ ưu tiên**: High
- **Loại**: Negative

### EC-07: OrderItem Not Found / Not Owned
- **Mô tả**: Test review orderItem không tồn tại hoặc không thuộc user
- **Bước thực hiện**:
  1. POST review với orderItemId='not-found'
  2. POST review với orderItemId thuộc user khác
- **Kết quả mong đợi**:
  - Bước 1: Status 404 (orderItem không tồn tại)
  - Bước 2: Status 404 (không tìm thấy orderItem thuộc user)
- **Độ ưu tiên**: High
- **Loại**: Negative

### EC-08: Review Not Found / Not Owned for Update/Delete
- **Mô tả**: Test update/delete review không tồn tại hoặc không thuộc user
- **Bước thực hiện**:
  1. PUT /api/reviews/not-found với valid body
  2. DELETE /api/reviews/not-found
  3. PUT /api/reviews/other-user-review (review của user khác)
  4. DELETE /api/reviews/other-user-review
- **Kết quả mong đợi**:
  - Bước 1-2: Status 404 (review không tồn tại)
  - Bước 3-4: Status 404 (review không thuộc về user)
- **Độ ưu tiên**: High
- **Loại**: Negative

### EC-09: Toggle Helpful on REJECTED Review
- **Mô tả**: Test vote helpful cho review bị từ chối
- **Bước thực hiện**:
  1. POST /api/reviews/rejected-review-id/helpful
- **Kết quả mong đợi**:
  - Status 404 với message 'Đánh giá không tồn tại'
  - Logic chỉ cho vote helpful khi status=APPROVED
- **Độ ưu tiên**: Medium
- **Loại**: Negative

### EC-10: Toggle Helpful on Deleted Review
- **Mô tả**: Test vote helpful cho review đã xóa
- **Bước thực hiện**:
  1. Xóa review (admin hoặc user)
  2. POST /api/reviews/deleted-review-id/helpful
- **Kết quả mong đợi**:
  - Status 404 với message 'Đánh giá không tồn tại'
- **Độ ưu tiên**: Medium
- **Loại**: Negative

### EC-11: Admin Reply Empty Content
- **Mô tả**: Test admin reply với content rỗng
- **Bước thực hiện**:
  1. POST /api/admin/reviews/review-1/reply
  2. Body: { content: "" }
  3. Body: { content: null }
  4. Body: {} (missing content)
- **Kết quả mong đợi**:
  - Tất cả: Status 400 với message 'Nội dung phải có ít nhất 1 ký tự'
- **Độ ưu tiên**: High
- **Loại**: Negative

### EC-12: Admin Reply > 1000 Chars
- **Mô tả**: Test admin reply quá dài
- **Bước thực hiện**:
  1. POST /api/admin/reviews/review-1/reply
  2. Body: { content: "A".repeat(1001) }
- **Kết quả mong đợi**:
  - Status 400 với message 'Nội dung không được quá 1000 ký tự'
- **Độ ưu tiên**: Medium
- **Loại**: Negative

---

## 5. Security Tests (6 Tests)

### SEC-01: Public Endpoints - No Authentication Required
- **Mô tả**: Verify public endpoints không cần authentication
- **Bước thực hiện**:
  1. GET /api/products/:slug/reviews/summary (không có token)
  2. GET /api/products/:slug/reviews (không có token)
- **Kết quả mong đợi**:
  - Tất cả: Status 200, trả về dữ liệu bình thường
  - Không yêu cầu Authorization header
- **Độ ưu tiên**: High
- **Loại**: Security

### SEC-02: User Endpoints - Authentication Required
- **Mô tả**: Verify user endpoints yêu cầu authentication
- **Bước thực hiện**:
  1. GET /api/users/me/reviews/pending (không có token)
  2. GET /api/users/me/reviews (không có token)
  3. POST /api/order-items/:id/review (không có token)
  4. PUT /api/reviews/:id (không có token)
  5. DELETE /api/reviews/:id (không có token)
  6. POST /api/reviews/:id/helpful (không có token)
- **Kết quả mong đợi**:
  - Tất cả: Status 401 (Unauthorized)
  - Message yêu cầu login
- **Độ ưu tiên**: High
- **Loại**: Security

### SEC-03: Admin Endpoints - STAFF+ Authorization
- **Mô tả**: Verify admin endpoints chỉ dành cho STAFF+
- **Bước thực hiện**:
  1. GET /api/admin/reviews với CUSTOMER token
  2. POST /api/admin/reviews/:id/reply với CUSTOMER token
  3. DELETE /api/admin/reviews/:id với CUSTOMER token
  4. Tất cả với ADMIN/STAFF token
- **Kết quả mong đợi**:
  - Bước 1-3: Status 403 (Forbidden)
  - Bước 4: Status 200/204 (success)
- **Độ ưu tiên**: High
- **Loại**: Security

### SEC-04: Ownership Check - User Cannot Modify Other's Review
- **Mô tả**: Verify user không thể modify/delete review của người khác
- **Bước thực hiện**:
  1. User-A (userId='user-1') tạo review
  2. User-B (userId='user-2') cố gắng PUT /api/reviews/user-1-review
  3. User-B cố gắng DELETE /api/reviews/user-1-review
- **Kết quả mong đợi**:
  - Bước 2-3: Status 404 (review không tồn tại/tìm thấy)
  - User-B chỉ thấy được review của chính mình
- **Độ ưu tiên**: High
- **Loại**: Security

### SEC-05: Verified Purchase - Only DELIVERED Orders
- **Mô tả**: Verify chỉ có thể review đơn hàng đã giao thành công
- **Bước thực hiện**:
  1. Tạo review cho order PENDING
  2. Tạo review cho order CANCELLED
  3. Tạo review cho order RETURNED
  4. Tạo review cho order DELIVERED
- **Kết quả mong đợi**:
  - Bước 1-3: Status 404 (không tìm thấy đơn hàng đã giao)
  - Bước 4: Status 201 (tạo thành công)
- **Độ ưu tiên**: High
- **Loại**: Security

### SEC-06: Photo Upload Validation - Prevent Malicious Files
- **Mô tả**: Verify upload ảnh có validate loại file và nội dung
- **Bước thực hiện**:
  1. Upload file .jpg với content恶意 (malicious content)
  2. Upload file .php với extension rename thành .jpg
  3. Upload file ảnh quá lớn (DoS attack)
  4. Upload file ảnh với embedded script (XSS)
- **Kết quả mong đợi**:
  - Bước 1-2: Middleware kiểm tra MIME type thực tế, reject file PHP
  - Bước 3: Size limit chặn file quá lớn
  - Bước 4: Cloudinary validate và sanitize file
  - Tất cả malicious attempts bị chặn
- **Độ ưu tiên**: High
- **Loại**: Security

---

## 6. Performance Tests (4 Tests)

### PT-01: Review Summary < 300ms (p95)
- **Mô tả**: Performance test cho GET /api/products/:slug/reviews/summary
- **Tiền điều kiện**: 
  - Product có 1000+ reviews
  - Database đã được indexed
- **Bước thực hiện**:
  1. Gửi 100 requests GET /api/products/:slug/reviews/summary
  2. Measure response time cho mỗi request
  3. Calculate p50, p95, p99 latency
- **Kết quả mong đợi**:
  - p50 < 200ms
  - p95 < 300ms
  - p99 < 500ms
  - N queries database ≤ 3 (aggregate + groupBy + count)
- **Độ ưu tiên**: High
- **Loại**: Performance

### PT-02: List Reviews < 200ms (p95)
- **Mô tả**: Performance test cho GET /api/products/:slug/reviews
- **Tiền điều kiện**: 
  - Product có 500+ reviews
  - Có filter và sort parameters
- **Bước thực hiện**:
  1. Gửi 100 requests với các combinations:
     - Không filter, không sort
     - Filter rating=5
     - Filter hasPhoto=true
     - Sort helpful
     - Combined filters
  2. Measure response times
- **Kết quả mong đợi**:
  - p95 < 200ms cho tất cả combinations
  - Pagination queries efficient (use LIMIT/OFFSET correctly)
  - Photos eager loading không gây N+1 queries
- **Độ ưu tiên**: High
- **Loại**: Performance

### PT-03: Create Review < 500ms (p95)
- **Mô tả**: Performance test cho POST /api/order-items/:id/review
- **Tiền điều kiện**: 
  - Upload middleware hoạt động
  - Cloudinary có latency ~200ms per upload
- **Bước thực hiện**:
  1. Gửi 100 requests POST review với:
     - 0 photos
     - 2 photos
     - 5 photos
  2. Measure response times
- **Kết quả mong đợi**:
  - 0 photos: p95 < 200ms
  - 2 photos: p95 < 400ms
  - 5 photos: p95 < 500ms
  - Upload photos diễn ra song song (Promise.all)
  - Database transaction ACID compliant
- **Độ ưu tiên**: Medium
- **Loại**: Performance

### PT-04: Toggle Helpful < 100ms (p95)
- **Mô tả**: Performance test cho POST /api/reviews/:id/helpful
- **Tiền điều kiện**: 
  - Review có nhiều helpful votes
- **Bước thực hiện**:
  1. Gửi 100 requests toggle helpful (create và delete)
  2. Measure response times
- **Kết quả mong đợi**:
  - p95 < 100ms
  - p99 < 150ms
  - Operation là O(1) - không phụ thuộc số lượng votes
  - Unique constraint check không gây performance degradation
- **Độ ưu tiên**: Medium
- **Loại**: Performance

---

## Tổng Kết Test Coverage

### Coverage Breakdown:
- **Unit Tests**: 10/10 (100%) - Các validator và helper functions
- **Integration Tests**: 12/12 (100%) - Tất cả API endpoints
- **E2E Tests**: 7/7 (100%) - Các user flows chính
- **Edge Cases**: 12/12 (100%) - Các boundary conditions
- **Security Tests**: 6/6 (100%) - Authentication và authorization
- **Performance Tests**: 4/4 (100%) - SLA compliance

### Tổng Test Cases: 51/51 (100%)

### Priority Distribution:
- **High**: 34 test cases (66.7%)
- **Medium**: 17 test cases (33.3%)

### Type Distribution:
- **Positive**: 27 test cases (52.9%)
- **Negative**: 18 test cases (35.3%)
- **Edge**: 4 test cases (7.8%)
- **Security**: 6 test cases (11.8%)
- **Performance**: 4 test cases (7.8%)

**Note**: Một số test cases có multiple types (ví dụ: cả Negative và Security), nên tổng percentage có thể >100%.

---

## Execution Guidelines

### Test Environment Setup:
1. **Database**: Test database với seed data đầy đủ
2. **Cloudinary**: Test environment hoặc mock cho upload ảnh
3. **Authentication**: Test users với varied roles (CUSTOMER, ADMIN, STAFF)
4. **Orders**: Test orders với các statuses (PENDING, DELIVERED, CANCELLED)

### Test Execution Order:
1. Unit Tests (fastest, isolated)
2. Security Tests (validate permissions first)
3. Integration Tests (API level)
4. E2E Tests (full user flows)
5. Edge Cases (boundary conditions)
6. Performance Tests (load testing)

### Automation Recommendations:
- **Unit Tests**: Run on every commit (pre-commit hook)
- **Integration Tests**: Run on every PR (CI pipeline)
- **E2E Tests**: Run nightly hoặc pre-release
- **Security Tests**: Run on every deploy to staging
- **Performance Tests**: Run weekly hoặc pre-major-release

### Success Criteria:
- **Pass Rate**: ≥95% test cases pass
- **Coverage**: ≥90% code coverage
- **Performance**: Tất cả SLA targets đạt được
- **Security**: Zero critical vulnerabilities
- **E2E**: Tất cả user flows hoạt động end-to-end

---

## Notes và Maintenance

### Regular Updates:
- Cập nhật test cases khi có tính năng mới
- Review và update test data định kỳ
- Refactor tests khi code thay đổi lớn

### Test Data Management:
- Sử dụng seed data nhất quán
- Cleanup test data sau mỗi run
- Isolation giữa test cases

### Documentation:
- Cập nhật document này khi test cases thay đổi
- Changelog cho các test modifications
- Link test cases đến JIRA tickets/User Stories

---

**Document Version**: 1.0  
**Last Updated**: 2026-06-20  
**Maintained By**: QA Team  
**Approved By**: Lead Developer