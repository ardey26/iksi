# Iksi 

Welcome to the documentation! Iksi is a powerful-- yet simple URL shortener built with SvelteKit, Prisma, and Tailwind CSS. The name "Iksi" comes from the Filipino word for "short", reflecting its core purpose—making long URLs concise and easy to share. This guide will help you set up, and use Iksi efficiently.


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

### **Run Database Migrations**
```sh
npm run prisma migrate dev --name init
```

### **Start the Development Server**
```sh
npm run dev
```
The app should now be running at `http://localhost:5173/`

---

## 🚀 Features
- **Shorten URLs** quickly and efficiently
- **Customizable links** for branded URLs
---

## 🛠 API Usage

### **Shorten a URL**
To shorten a long URL, send a `POST` request to the `/shorten` route.

**Endpoint:** `POST /api/shorten`
**Payload:**
```json
{
  "longURL": "https://example.com",
  "customURL": "my-link"  // (Optional)
}
```
**Response:**
```json
{
  "shortUrl": "https://iksi.io/my-link"
}
```
---

## 🤝 Contributing
We welcome contributions! Feel free to open an issue or submit a pull request.
---

## 📜 License
Iksi is licensed under the MIT License.

For any questions, reach out via [GitHub Issues](https://github.com/yourusername/iksi/issues).

