// Twitter card uses the same image as Open Graph

// Route config must be defined directly (cannot be re-exported)
export const runtime = 'nodejs'
export const alt = 'Trust Center App Verification'
export const size = {width: 1200, height: 630}
export const contentType = 'image/png'

// Re-export the image generator
export {default} from './opengraph-image'
