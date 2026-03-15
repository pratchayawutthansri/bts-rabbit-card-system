# 🎫 BTS Rabbit Card Management System

> [!IMPORTANT]
> **สถานะโครงการ:** 🛠️ อยู่ในขั้นตอนการพัฒนา (Under Development)

ระบบจัดการบัตรแรบบิท (BTS Rabbit Card) แบบครบวงจร พัฒนาด้วย Stack สมัยใหม่ เพื่อความรวดเร็วและความปลอดภัยสูงสุด

---

## ✨ คุณสมบัติเด่น (Features)
- 🔒 **ระบบสมาชิก:** ลงทะเบียนและเข้าสู่ระบบด้วย JWT
- 💳 **จัดการบัตร:** ตรวจสอบยอดเงิน และประวัติการใช้งาน
- 🗺️ **คำนวณค่าโดยสาร:** ระบบคำนวณค่าเดินทางตามสถานี BTS
- 📱 **Responsive Design:** รองรับการใช้งานทั้งบนมือถือและคอมพิวเตอร์
- 🐳 **Docker Support:** ติดตั้งและรันระบบได้ง่ายผ่าน Docker Compose

## 🛠️ Technology Stack
- **Frontend:** React 19, Vite, TypeScript, Vanilla CSS
- **Backend:** Node.js (Express)
- **Database:** MySQL 8.0
- **DevOps:** Docker & Docker Compose

## 🚀 เริ่มต้นใช้งาน (Getting Started)

### 1. การตั้งค่า Environment
คัดลอกไฟล์ต้นแบบและตั้งค่ารหัสผ่านของคุณเอง:
```powershell
cp server/.env.example server/.env
```

### 2. รันระบบด้วย Docker
ใช้คำสั่งด้านล่างเพื่อเปิดใช้งาน Database และ phpMyAdmin:
```powershell
docker-compose up -d
```

### 3. รัน Backend
```powershell
cd server
npm install
npm run dev
```

### 4. รัน Frontend
```powershell
cd server/client
npm install
npm run dev
```

---

## 👨‍💻 ผู้พัฒนา
- **FLUKEXD** - *Lead Developer*

---
*Last Updated: 2026-03-16*
