// index.js
const express = require('express');
const bodyParser = require('body-parser');
const db = require('./firebase');

const app = express();
app.use(bodyParser.json());

const PORT = process.env.PORT || 3000;

// Endpoint untuk menambah atau memperbarui barang
app.post('/add', async (req, res) => {
    try {
        const { nama, jumlah, satuan } = req.body;

        if (!nama || !jumlah || !satuan) {
            return res.status(400).send('Nama, jumlah, dan satuan harus disertakan.');
        }

        if (satuan !== 'ml' && satuan !== 'g') {
            return res.status(400).send('Satuan hanya bisa ml atau g.');
        }

        let jumlahFormatted = parseFloat(jumlah);
        let satuanFormatted = satuan;

        const itemsSnapshot = await db.collection('barang').where('nama', '==', nama).get();

        if (itemsSnapshot.empty) {
            const data = {
                nama,
                jumlah: jumlahFormatted,
                satuan: satuanFormatted,
                riwayat: [
                    {
                        jumlah: jumlahFormatted,
                        satuan: satuanFormatted,
                        catatan: `Ditambah: ${jumlahFormatted} ${satuanFormatted}`
                    }
                ]
            };

            await db.collection('barang').add(data);
            return res.status(200).send('Barang ditambahkan.');
        }

        const existingItem = itemsSnapshot.docs[0];
        const existingData = existingItem.data();

        let currentJumlah = existingData.jumlah;
        let currentSatuan = existingData.satuan;
        let riwayat = existingData.riwayat || [];

        if (currentSatuan === 'kg' && satuanFormatted === 'g') {
            jumlahFormatted *= 1000;
            satuanFormatted = 'g';
        } else if (currentSatuan === 'g' && satuanFormatted === 'kg') {
            currentJumlah /= 1000;
            currentSatuan = 'kg';
        } else if (currentSatuan === 'L' && satuanFormatted === 'ml') {
            currentJumlah *= 1000;
            currentSatuan = 'ml';
        } else if (currentSatuan === 'ml' && satuanFormatted === 'L') {
            currentJumlah /= 1000;
            currentSatuan = 'L';
        }

        currentJumlah += jumlahFormatted;
        riwayat.push({
            jumlah: jumlahFormatted,
            satuan: satuanFormatted,
            catatan: `Ditambah: ${jumlahFormatted} ${satuanFormatted}`
        });

        await existingItem.ref.update({
            jumlah: currentJumlah,
            satuan: currentSatuan,
            riwayat: riwayat
        });

        res.status(200).send(`Barang ${nama} diperbarui.`);
    } catch (error) {
        res.status(500).send(error.message);
    }
});



// Endpoint untuk menambah atau mengurangi barang
app.post('/update', async (req, res) => {
    try {
        const { id, jumlah, satuan, action } = req.body;

        if (!id || !jumlah || !satuan || !action) {
            return res.status(400).send('ID, jumlah, satuan, dan action harus disertakan.');
        }

        if (satuan !== 'ml' && satuan !== 'g') {
            return res.status(400).send('Satuan hanya bisa ml atau g.');
        }

        // Lanjutan kode ...
    } catch (error) {
        res.status(500).send(error.message);
    }
});



// Endpoint untuk mendapatkan riwayat perubahan untuk semua barang
app.get('/history', async (req, res) => {
    try {
        const itemsSnapshot = await db.collection('barang').get();
        const history = [];

        itemsSnapshot.forEach(doc => {
            const { riwayat } = doc.data();
            riwayat.forEach(entry => {
                let { jumlah, satuan } = entry;

                // Konversi ke kilogram jika satuan saat ini adalah gram dan jumlah lebih dari 1000
                if (satuan === 'g' && jumlah >= 1000) {
                    jumlah /= 1000;
                    satuan = 'kg';
                } else if (satuan === 'ml' && jumlah >= 1000) {
                    jumlah /= 1000;
                    satuan = 'L';
                }

                history.push({
                    nama: doc.data().nama,
                    jumlah: jumlah,
                    satuan: satuan
                });
            });
        });

        res.status(200).json({ history });
    } catch (error) {
        res.status(500).send(error.message);
    }
});



// Endpoint untuk menampilkan semua barang
app.get('/items', async (req, res) => {
    try {
        const itemsSnapshot = await db.collection('barang').get();
        const items = itemsSnapshot.docs.map(doc => {
            const data = doc.data();
            let { jumlah, satuan } = data;

            // Konversi ke kilogram jika satuan saat ini adalah gram dan jumlah lebih dari 1000
            if (satuan === 'g' && jumlah >= 1000) {
                jumlah /= 1000;
                satuan = 'kg';
            } else if (satuan === 'ml' && jumlah >= 1000) {
                jumlah /= 1000;
                satuan = 'L';
            }

            return {
                id: doc.id,
                nama: data.nama,
                jumlah: jumlah,
                satuan: satuan,
                riwayat: data.riwayat
            };
        });

        res.status(200).json(items);
    } catch (error) {
        res.status(500).send(error.message);
    }
});




// Menjalankan server pada PORT yang ditentukan
app.listen(PORT, () => {
    console.log(`Server berjalan di http://localhost:${PORT}`);
});
