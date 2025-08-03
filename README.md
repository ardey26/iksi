# Iksi ⚡

Welcome to the documentation! Iksi is a high-performance, secure URL shortener built with SvelteKit, Prisma, and modern web technologies. The name "Iksi" comes from the Filipino word for "short", reflecting its core purpose—making long URLs concise and easy to share. This guide will help you set up and use Iksi efficiently.

## ✨ What's New

This version includes significant performance and security optimizations:

### 🚀 **Performance Enhancements**
- **Optimized Database Connections** - Singleton Prisma client prevents connection pool exhaustion
- **Cryptographic Random Generation** - Uses `crypto.randomBytes()` for better short URL uniqueness
- **Client-Side Validation** - Real-time URL and alias validation for improved UX
- **Enhanced CSS Performance** - Hardware acceleration and optimized animations
- **Smart Code Splitting** - Optimized Vite configuration for faster builds

### 🛡️ **Security Improvements**  
- **Rate Limiting** - Configurable request limits (20 req/min in production)
- **Input Sanitization** - Comprehensive server-side validation
- **Security Headers** - XSS protection, content type options, and frame guards
- **SSRF Protection** - Blocks localhost/internal network URLs
- **Request Size Limits** - 4KB request body limit prevents abuse

### 🎨 **User Experience**
- **Progressive Enhancement** - Graceful loading states and error handling
- **Accessibility** - ARIA labels, keyboard navigation (Ctrl/Cmd+Enter)
- **Better Error Messages** - User-friendly feedback with auto-clearing
- **Improved Copy Functionality** - Cross-browser clipboard support with fallbacks

---

## 📦 Installation & Setup

### **Prerequisites**
Ensure you have the following installed:
- [Node.js](https://nodejs.org/)
- [PostgreSQL](https://www.postgresql.org/) or another supported database
- [Prisma](https://www.prisma.io/)
- [npm](https://www.npmjs.com/)

### **Clone the Repository**
```sh
git clone https://github.com/ardey26/iksi.git
cd iksi
```

### **Install Dependencies**
```sh
npm install
```

### **Set Up Environment Variables**
Create a `.env` file in the project root and add your database connection string:
```env
DATABASE_URL="postgresql://user:password@localhost:5432/iksi"
```

### **Generate Prisma Client**
```sh
npx prisma generate
```

### **Set Up Database** 
Push the schema to your database:
```sh
npx prisma db push
```

### **Start the Development Server**
```sh
npm run dev
```
The app should now be running at `http://localhost:5173/`

---

## ⚙️ Configuration

Iksi includes environment-based configuration for optimal performance:

### **Rate Limiting**
- **Production**: 20 requests per minute per IP
- **Development**: 100 requests per minute per IP

### **Short URL Settings**
- **Length**: 7 characters (optimized for readability)
- **Character Set**: Excludes confusing characters (0, O, I, l)
- **Collision Retries**: 5 attempts before failing

### **Security Limits**
- **URL Length**: Max 2048 characters
- **Custom Alias**: Max 50 characters
- **Request Body**: Max 4KB

---

## 🚀 Features

### **Core Functionality**
- **Lightning-Fast URL Shortening** - Optimized algorithms for quick processing
- **Custom Aliases** - Create branded, memorable short links
- **Collision-Free Generation** - Cryptographic randomness prevents duplicates
- **URL Validation** - Comprehensive security checks and format validation

### **Performance & Reliability**
- **Database Optimizations** - Efficient queries with selective field fetching
- **Error Resilience** - Graceful handling of timeouts, database issues, and network errors
- **Rate Limiting** - Prevents abuse while maintaining good user experience
- **Responsive Design** - Optimized for mobile and desktop devices

### **Security Features**
- **Input Validation** - Server and client-side protection against malicious input
- **SSRF Protection** - Blocks internal network and localhost URLs
- **Content Security** - Headers and policies to prevent common web attacks
- **Request Monitoring** - Rate limiting and size restrictions

---

## 🛠 API Usage

### **Shorten a URL**
Create a shortened URL with optional custom alias.

**Endpoint:** `POST /api/shorten`

**Request Headers:**
```
Content-Type: application/json
```

**Payload:**
```json
{
  "longURL": "https://example.com/very/long/url/path",
  "customURL": "my-awesome-link"  // Optional: custom alias (max 50 chars)
}
```

**Success Response (200):**
```json
{
  "shortURL": "my-awesome-link"
}
```

**Error Responses:**
```json
// Invalid URL
{
  "error": "you provided an invalid URL"
}

// Custom alias already exists
{
  "error": "custom link alias already exists, pick another one"
}

// Rate limit exceeded
{
  "error": "Too many requests. Please wait a minute."
}
```

### **Access Shortened URL**
Navigate to any shortened URL to be redirected:

**Endpoint:** `GET /{shortURL}`
**Response:** 302 redirect to original URL

### **Error Handling**
The API returns appropriate HTTP status codes:
- `200` - Success
- `400` - Bad Request (invalid input)
- `409` - Conflict (alias already exists)
- `413` - Request too large
- `429` - Rate limit exceeded
- `500` - Server error

---

## 🏗️ Architecture

### **Tech Stack**
- **Frontend**: SvelteKit + Tailwind CSS
- **Backend**: SvelteKit API Routes
- **Database**: PostgreSQL with Prisma ORM
- **Security**: Built-in rate limiting and validation
- **Performance**: Optimized bundling and caching

### **Key Components**
- `/src/routes/+page.svelte` - Main URL shortening interface
- `/src/routes/api/shorten/+server.js` - URL shortening API
- `/src/routes/[slug]/+page.js` - URL redirect handler
- `/src/lib/prisma.js` - Database connection singleton
- `/src/lib/rateLimit.js` - Request rate limiting
- `/src/lib/utils/` - Validation and utility functions

---

## 🚀 Performance Tips

### **Production Deployment**
1. **Build Optimization**: Run `npm run build` for production builds
2. **Database Indexes**: Consider adding indexes on frequently queried fields
3. **Caching**: Implement Redis or similar for enhanced performance
4. **CDN**: Use a CDN for static assets
5. **Environment Variables**: Set `NODE_ENV=production`

### **Monitoring**
- Monitor rate limit violations
- Track database connection pool usage
- Watch for error patterns in logs
- Monitor response times and throughput

---

## 🔧 Development

### **Project Structure**
```
src/
├── lib/
│   ├── components/     # Svelte components
│   ├── utils/         # Utility functions
│   ├── prisma.js      # Database singleton
│   ├── rateLimit.js   # Rate limiting logic
│   └── config.js      # Environment configuration
├── routes/
│   ├── api/shorten/   # URL shortening API
│   ├── [slug]/        # Dynamic redirect routes
│   └── +page.svelte   # Main interface
└── app.html           # HTML template
```

### **Available Scripts**
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier

---

## 🤝 Contributing

We welcome contributions! Here's how to get started:

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Make your changes** with proper tests
4. **Follow the code style** using the included ESLint and Prettier configs
5. **Submit a pull request** with a clear description

### **Code Style**
- Use ESLint and Prettier configurations
- Follow SvelteKit conventions
- Add comments for complex logic
- Include error handling

---

## 📜 License

Iksi is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

---

## 🆘 Support

For questions, issues, or contributions:
- **GitHub Issues**: [Report bugs or request features](https://github.com/ardey26/iksi/issues)
- **Discussions**: [Community discussions](https://github.com/ardey26/iksi/discussions)

---

## 🙏 Acknowledgments

Built with modern web technologies:
- [SvelteKit](https://kit.svelte.dev/) - The web framework
- [Prisma](https://www.prisma.io/) - Database toolkit
- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS
- [Vite](https://vitejs.dev/) - Build tool

