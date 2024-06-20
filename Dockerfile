# Menggunakan image node.js resmi sebagai base image
FROM node:14

# Menentukan direktori kerja di dalam container
WORKDIR /usr/src/app

# Menyalin package.json dan package-lock.json ke dalam container
COPY package*.json ./

# Menginstall dependencies
RUN npm install

# Menyalin semua file ke dalam container
COPY . .

# Menentukan port yang akan digunakan
EXPOSE 8080

# Menjalankan aplikasi
CMD ["node", "server.js"]
