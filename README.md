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
- **URL Encryption** - Long URLs are encrypted before storage using AES-256-GCM for enhanced privacy
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
- [pnpm](https://pnpm.io/)

### **Clone the Repository**
```sh
git clone https://github.com/ardey26/iksi.git
cd iksi
```

### **Install Dependencies**
The repo is a pnpm workspace (Node 22+, see `.nvmrc`):
```sh
pnpm install
```

### **Set Up Environment Variables**
Create `apps/web/.env` with your database connection string and encryption key:
```env
DATABASE_URL="postgresql://user:password@localhost:5432/iksi"
SECRET_KEY="your-32-character-secret-encryption-key"
```

**Important:** The SECRET_KEY is used for encrypting URLs. Use a strong, unique 32+ character key in production.

### **Set Up Database**
`pnpm install` generates the Prisma client. Push the schema to your database:
```sh
pnpm --filter @iksi/web exec prisma db push
```

### **Run Locally**
```sh
pnpm --filter @iksi/web dev        # app at http://localhost:5173/
pnpm --filter @iksi/redirect dev   # edge Worker via wrangler dev
pnpm -r test                       # every workspace's tests
```

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
- **Flexible Input Format** - Accepts simple domains (example.com) or full URLs
- **Custom Aliases** - Create branded, memorable short links
- **Collision-Free Generation** - Cryptographic randomness prevents duplicates
- **URL Validation** - Comprehensive security checks and format validation
- **Smart Routing** - Send visitors to different destinations by device, country or language
- **Expiry** - Links can expire on a date or after a click cap
- **Passwords** - Protect a link behind a password
- **Preview** - Add `+` to any short link (`/abc+`) to see where it goes before you click

### **Performance & Reliability**
- **Database Optimizations** - Efficient queries with selective field fetching
- **Error Resilience** - Graceful handling of timeouts, database issues, and network errors
- **Rate Limiting** - Prevents abuse while maintaining good user experience
- **Responsive Design** - Optimized for mobile and desktop devices

### **Security Features**
- **URL Encryption** - All long URLs are encrypted using AES-256-GCM before database storage, ensuring privacy even with database access
- **URL Hash Indexing** - Efficient duplicate detection using SHA-256 with full backward compatibility
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
  "longURL": "example.com",
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

iksi is moving to an edge-first design. The redirect is the only latency-critical path and it is read-mostly, so it belongs at the edge next to the person clicking; everything else (dashboard, profiles, API, jobs, database) is a control plane that tolerates one region.

### **Target (v2)**
```
  iksi.app/abc ──▶ Cloudflare Worker ──KV lookup──▶ 302 (≈10–30 ms at the nearest PoP)
  go.acme.com/abc ─┘   │ miss                 │ click event
                       ▼                      ▼
                origin /internal/resolve   Queue ──▶ consumer ──batch──▶ /internal/ingest
                       │
                       ▼
     SvelteKit app (Vercel, sin1) + Postgres (Supabase, ap-southeast-1)
     R2: avatars, OG images, nightly database backups
```

### **Today**
The Worker answers redirects itself: it reads the link from KV, falls back to the origin on a miss and caches the result, and ships click events through a queue to the origin in batches. Other paths pass through to the origin, tagged with `x-iksi-route` (`slug`, `reserved`, `root`, `unknown`). Editing or flagging a link purges its edge entry. Latency before the cutover is recorded in [perf/](perf/README.md).

### **Workspaces**
| Path | What it is |
|---|---|
| `apps/web` | SvelteKit app: shortener UI, dashboard, `@handle` profiles, auth, API |
| `apps/redirect` | Cloudflare Worker on `iksi.app/*` |
| `packages/core` | Pure TypeScript shared by both: path classification, later the routing-rules engine |
| `infra/cloudflare` | DNS cutover runbook with verification and rollback |
| `infra/backup` | Nightly `pg_dump` to R2 and a restore check |
| `perf` | k6 scripts and committed latency reports |

---

## 🚀 Performance Tips

### **Production Deployment**
1. **Build Optimization**: Run `pnpm -r build` for production builds
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

### **Available Scripts**
Run from the repo root:
- `pnpm -r test` - Run every workspace's tests
- `pnpm -r build` - Build every workspace
- `pnpm -r lint` - Lint every workspace
- `pnpm --filter @iksi/web dev` - Start the app's dev server
- `pnpm --filter @iksi/redirect deploy` - Deploy the edge Worker

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

