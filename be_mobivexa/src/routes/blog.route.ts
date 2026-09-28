import { Router } from 'express'
import { authenticate } from '../middlewares/auth.middleware'
import { authorize, STAFF_ROLES } from '../middlewares/authorize.middleware'
import { uploadImage } from '../middlewares/upload.middleware'
import { blogSearchLimiter } from '../middlewares/rate_limit.middleware'
import * as validator from '../validators/blog.validator'
import * as controller from '../controllers/blog.controller'

// ─── Public routes: /api/blog ──────────────────────────────────────────────────
const publicRouter: Router = Router()
publicRouter.get('/posts', controller.listPosts)
publicRouter.get('/search', blogSearchLimiter, controller.search)
publicRouter.get('/posts/:slug', controller.getPostBySlug)
publicRouter.post('/posts/:slug/view', controller.viewPost)
publicRouter.get('/preview/:token', controller.getPreview)
publicRouter.get('/categories', controller.listPublicCategories)
publicRouter.get('/content-types', controller.listContentTypes)
publicRouter.get('/sitemap.xml', controller.sitemap)
publicRouter.get('/rss.xml', controller.rss)

// ─── Admin routes: /api/admin/blog ─────────────────────────────────────────────
const adminRouter: Router = Router()
adminRouter.use(authenticate, authorize(...STAFF_ROLES))

// Posts
adminRouter.get('/posts', controller.listPostsAdmin)
adminRouter.get('/posts/:id', controller.getPostByIdAdmin)
adminRouter.post('/posts', validator.validateCreatePost, controller.createPost)
adminRouter.put('/posts/:id', validator.validateUpdatePost, controller.updatePost)
adminRouter.patch('/posts/:id/status', validator.validateUpdatePostStatus, controller.updatePostStatus)
adminRouter.delete('/posts/:id', controller.deletePost)
adminRouter.put('/posts/:id/cover', uploadImage.single('image'), controller.updatePostCover)
adminRouter.delete('/posts/:id/cover', controller.deletePostCover)
adminRouter.post('/posts/:id/preview-token', controller.createPreviewToken)
adminRouter.post('/images', uploadImage.single('image'), controller.uploadContentImage)
adminRouter.get('/product-options', controller.productOptions)

// Categories
adminRouter.get('/categories', controller.listCategoriesAdmin)
adminRouter.post('/categories', validator.validateCreateBlogCategory, controller.createCategory)
adminRouter.put('/categories/:id', validator.validateUpdateBlogCategory, controller.updateCategory)
adminRouter.delete('/categories/:id', controller.deleteCategory)
adminRouter.patch('/categories/:id/status', controller.toggleCategoryStatus)

// Tags
adminRouter.get('/tags', controller.listTags)
adminRouter.post('/tags', validator.validateCreateBlogTag, controller.createTag)
adminRouter.put('/tags/:id', validator.validateUpdateBlogTag, controller.updateTag)
adminRouter.delete('/tags/:id', controller.deleteTag)

export const blogRoutes: Router = publicRouter
export const blogAdminRoutes: Router = adminRouter
