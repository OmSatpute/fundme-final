const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'fundme_documents',
    allowed_formats: ['jpg', 'png', 'pdf', 'docx', 'txt'],
    // Use the original filename as public_id
    public_id: (req, file) => `${Date.now()}-${file.originalname.split('.')[0]}`,
  },
});

module.exports = {
  cloudinary,
  storage
};
