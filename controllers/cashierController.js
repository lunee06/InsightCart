const db = require('../firebase');

const getNextSequenceNumber = async () => {
    const counterRef = db.collection('counters').doc('transaction_counter');
    const transaction = await db.runTransaction(async (transaction) => {
        const doc = await transaction.get(counterRef);
        
        if (!doc.exists) {
            // Jika dokumen tidak ada, buat dokumen baru dengan nilai awal
            transaction.set(counterRef, { lastNumber: 0 });
            return 0; // Mengembalikan nilai awal
        }

        const currentNumber = doc.data().lastNumber || 0;
        const nextNumber = currentNumber + 1;
        transaction.update(counterRef, { lastNumber: nextNumber });
        return nextNumber;
    });
    return transaction;
};


const generateTransactionId = async () => {
    try {
        // Mendapatkan tanggal hari ini
        const today = new Date();
        const year = today.getFullYear().toString().substr(-2); // Dua digit terakhir tahun
        const month = ('0' + (today.getMonth() + 1)).slice(-2); // Dua digit bulan (dipad dengan 0 jika perlu)
        const day = ('0' + today.getDate()).slice(-2); // Dua digit tanggal (dipad dengan 0 jika perlu)

        // Mendapatkan nomor urut dari basis data
        const sequenceNumber = await getNextSequenceNumber();

        // Membuat ID transaksi dengan format YYMMDDNNN
        const transactionId = `${year}${month}${day}${sequenceNumber}`;

        return transactionId;
    } catch (error) {
        console.error('Error generating transaction ID:', error);
        throw error;
    }
};


const checkout = async (req, res) => {
    try {
        const { orderItems } = req.body;

        // Validasi orderItems
        if (!orderItems || !Array.isArray(orderItems) || orderItems.length === 0) {
            return res.status(400).send('Order items harus disertakan dan tidak boleh kosong.');
        }

        let totalHarga = 0;
        let inventoryUpdates = [];
        let transactionItems = [];

        // Iterasi melalui setiap item dalam orderItems
        for (const item of orderItems) {
            const { id, quantity } = item;

            // Validasi ketersediaan menu
            const menuSnapshot = await db.collection('menu').doc(id).get();

            if (!menuSnapshot.exists) {
                return res.status(404).send(`Menu dengan ID ${id} tidak ditemukan.`);
            }

            const menuData = menuSnapshot.data();
            const { ingredients, namaMenu, harga } = menuData;

            // Logging untuk memastikan namaMenu ada
            console.log(`Processing menu item: ${namaMenu}`);

            // Validasi ketersediaan ingredients
            for (const ingredient of ingredients) {
                const { nama, jumlah } = ingredient;

                // Periksa ketersediaan ingredient di inventory
                const itemsSnapshot = await db.collection('barang').where('nama', '==', nama).get();

                if (itemsSnapshot.empty) {
                    return res.status(400).send(`Ingredient ${nama} tidak ada di inventory.`);
                }

                const existingItem = itemsSnapshot.docs[0];
                const ingredientId = existingItem.id; // Menggunakan ID dokumen dari Firestore
                const existingData = existingItem.data();
                let { jumlah: existingJumlah, riwayat } = existingData;

                // Validasi ketersediaan jumlah ingredient
                if (existingJumlah < jumlah * quantity) {
                    return res.status(400).send(`Jumlah ingredient ${nama} tidak mencukupi.`);
                }

                // Hitung jumlah yang harus dikurangi dari inventory
                const newJumlah = existingJumlah - jumlah * quantity;

                // Tambahkan data update ke dalam array
                if (ingredientId && newJumlah !== undefined) {
                    inventoryUpdates.push({ id: ingredientId, newJumlah });

                    // Tambahkan catatan pengurangan ke riwayat dengan timestamp
                    const timestamp = new Date().toISOString();
                    riwayat.push({
                        nama: nama,
                        jumlah: jumlah * quantity,
                        satuan: existingData.satuan,
                        catatan: `Dikurangi: ${jumlah * quantity} ${existingData.satuan}`,
                        status: 0, // Status 0 untuk pengurangan
                        timestamp: timestamp // Tambahkan timestamp di sini
                    });

                    // Update dokumen inventaris di Firestore
                    await existingItem.ref.update({
                        jumlah: newJumlah,
                        riwayat: riwayat
                    });
                }
            }

            // Hitung total harga transaksi
            totalHarga += harga * quantity;

            // Tambahkan item ke transaksi
            transactionItems.push({
                namaMenu,
                quantity,
                harga
            });
        }

        // Lakukan update inventory dalam batch
        const batch = db.batch();
        inventoryUpdates.forEach(update => {
            const { id, newJumlah } = update;
            const inventoryRef = db.collection('barang').doc(id);
            batch.update(inventoryRef, { jumlah: newJumlah });
        });

        // Komitkan batch update
        await batch.commit();

        // Generate transaction ID
        const transactionId = await generateTransactionId();

        // Create transaction record
        const transactionRecord = {
            transactionId,
            date: new Date().toISOString(), // Timestamp saat transaksi terjadi
            items: transactionItems,
            totalHarga
        };

        // Save transaction record to Firestore
        await db.collection('transactions').doc(transactionId).set(transactionRecord);

        // Response jika checkout berhasil
        res.status(200).json({ message: 'Checkout berhasil.', totalHarga, transactionId });
    } catch (error) {
        // Tangani error dengan respons status 500
        console.error('Error during checkout:', error);
        res.status(500).send(error.message);
    }
};





const printReceipt = async (req, res) => {
    try {
        const { transactionId } = req.params;

        // Validasi transactionId
        if (!transactionId) {
            return res.status(400).send('Transaction ID harus disertakan.');
        }

        // Ambil transaction dari Firestore
        const transactionSnapshot = await db.collection('transactions').doc(transactionId).get();

        if (!transactionSnapshot.exists) {
            return res.status(404).send(`Transaksi dengan ID ${transactionId} tidak ditemukan.`);
        }

        const transactionData = transactionSnapshot.data();

        // Ubah format tanggal
        const transactionDate = new Date(transactionData.date);
        const formattedDate = `${transactionDate.getDate()}/${transactionDate.getMonth() + 1}/${transactionDate.getFullYear()}`;
        const formattedTime = `${transactionDate.getHours()}:${transactionDate.getMinutes()}:${transactionDate.getSeconds()}`;

        // Cetak nota
        const nota = {
            tanggal: `${formattedDate} ${formattedTime}`, // Menggunakan format tanggal dan waktu yang sesuai
            idTransaksi: transactionData.transactionId,
            items: transactionData.items.map(item => ({
                namaMenu: item.namaMenu,
                jumlah: item.quantity,
                harga: item.harga
            })),
            grandTotal: transactionData.totalHarga
        };

        // Response dengan nota
        res.status(200).json(nota);
    } catch (error) {
        // Tangani error dengan respons status 500
        console.error('Error printing receipt:', error);
        res.status(500).send(error.message);
    }
};

const getAllReceipts = async (req, res) => {
    try {
        // Ambil semua transaksi dari Firestore
        const transactionsSnapshot = await db.collection('transactions').get();

        if (transactionsSnapshot.empty) {
            return res.status(404).send('Tidak ada transaksi yang ditemukan.');
        }

        // Format setiap transaksi menjadi nota
        const receipts = [];
        transactionsSnapshot.forEach(doc => {
            const transactionData = doc.data();

            // Ubah format tanggal
            const transactionDate = new Date(transactionData.date);
            const formattedDate = `${transactionDate.getDate()}/${transactionDate.getMonth() + 1}/${transactionDate.getFullYear()}`;
            const formattedTime = `${transactionDate.getHours()}:${transactionDate.getMinutes()}:${transactionDate.getSeconds()}`;

            // Buat objek nota
            const nota = {
                tanggal: `${formattedDate} ${formattedTime}`, // Menggunakan format tanggal dan waktu yang sesuai
                idTransaksi: transactionData.transactionId,
                items: transactionData.items.map(item => ({
                    namaMenu: item.namaMenu,
                    jumlah: item.quantity,
                    harga: item.harga
                })),
                grandTotal: transactionData.totalHarga
            };

            // Tambahkan nota ke dalam array
            receipts.push(nota);
        });

        // Response dengan semua nota
        res.status(200).json(receipts);
    } catch (error) {
        // Tangani error dengan respons status 500
        console.error('Error retrieving receipts:', error);
        res.status(500).send(error.message);
    }
};



module.exports = {
    checkout,
    printReceipt,
    getAllReceipts
};
