const db = require('../firebase');

const addInventory = async (req, res) => {
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
                        catatan: `Ditambah: ${jumlahFormatted} ${satuanFormatted}`,
                        timestamp: new Date().toISOString()  // Tambahkan timestamp ISO string
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
            catatan: `Ditambah: ${jumlahFormatted} ${satuanFormatted}`,
            timestamp: new Date().toISOString()  // Tambahkan timestamp ISO string
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
};


const getInventoryItems = async (req, res) => {
    try {
        const itemsSnapshot = await db.collection('barang').get();
        const items = itemsSnapshot.docs.map(doc => {
            const data = doc.data();
            let { jumlah, satuan } = data;

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
};

const getInventoryHistory = async (req, res) => {
    try {
        const itemsSnapshot = await db.collection('barang').get();
        const history = [];

        itemsSnapshot.forEach(doc => {
            const { nama, riwayat } = doc.data();

            riwayat.forEach(entry => {
                let { jumlah, satuan, catatan, timestamp } = entry;

                // Tentukan status (1 untuk ditambah, 0 untuk dikurangi)
                const status = catatan.startsWith('Ditambah') ? 1 : 0;

                // Konversi timestamp Firestore ke objek Date JavaScript
                const transactionDate = new Date(timestamp);

                if (satuan === 'g' && jumlah >= 1000) {
                    jumlah /= 1000;
                    satuan = 'kg';
                } else if (satuan === 'ml' && jumlah >= 1000) {
                    jumlah /= 1000;
                    satuan = 'L';
                }

                // Format tanggal dan waktu dalam format yang diinginkan
                const formattedDate = `${('0' + transactionDate.getDate()).slice(-2)}/${('0' + (transactionDate.getMonth() + 1)).slice(-2)}/${transactionDate.getFullYear()}`;
                const formattedTime = `${('0' + transactionDate.getHours()).slice(-2)}:${('0' + transactionDate.getMinutes()).slice(-2)}:${('0' + transactionDate.getSeconds()).slice(-2)}`;

                history.push({
                    nama: nama,
                    jumlah: jumlah,
                    satuan: satuan,
                    status: status,
                    timestamp: `${formattedDate} ${formattedTime}` // Gabungkan date dan time
                });
            });
        });

        // Urutkan berdasarkan timestamp secara descending
        history.sort((a, b) => {
            const [dateA, timeA] = a.timestamp.split(' ');
            const [dayA, monthA, yearA] = dateA.split('/');
            const [hourA, minuteA, secondA] = timeA.split(':');

            const [dateB, timeB] = b.timestamp.split(' ');
            const [dayB, monthB, yearB] = dateB.split('/');
            const [hourB, minuteB, secondB] = timeB.split(':');

            const dateObjA = new Date(yearA, monthA - 1, dayA, hourA, minuteA, secondA);
            const dateObjB = new Date(yearB, monthB - 1, dayB, hourB, minuteB, secondB);

            return dateObjB - dateObjA;
        });

        res.status(200).json({ history });
    } catch (error) {
        res.status(500).send(error.message);
    }
};











module.exports = {
    addInventory,
    getInventoryItems,
    getInventoryHistory
};
