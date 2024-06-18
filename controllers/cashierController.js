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

const generateTransactionId = async (transactionDate, transactionTime) => {
    try {
        // Mendapatkan tanggal dari input atau dari saat ini
        const date = transactionDate ? new Date(transactionDate) : new Date();
        const year = date.getFullYear().toString().substr(-2); // Dua digit terakhir tahun
        const month = ('0' + (date.getMonth() + 1)).slice(-2); // Dua digit bulan (dipad dengan 0 jika perlu)
        const day = ('0' + date.getDate()).slice(-2); // Dua digit tanggal (dipad dengan 0 jika perlu)
        const hours = ('0' + transactionTime.getHours()).slice(-2); // Dua digit jam (dipad dengan 0 jika perlu)
        const minutes = ('0' + transactionTime.getMinutes()).slice(-2); // Dua digit menit (dipad dengan 0 jika perlu)
        const seconds = ('0' + transactionTime.getSeconds()).slice(-2); // Dua digit detik (dipad dengan 0 jika perlu)

        // Membuat ID transaksi dengan format YYMMDDHHMMSS
        const transactionId = `${year}${month}${day}${hours}${minutes}${seconds}`;

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
        const transactionDate = new Date(); // Gunakan waktu saat ini untuk transaksi

        // Iterasi melalui setiap item dalam orderItems
        for (const item of orderItems) {
            const { namaMenu, quantity } = item;

            // Validasi ketersediaan menu
            const menuSnapshot = await db.collection('menu').where('namaMenu', '==', namaMenu).get();

            if (menuSnapshot.empty) {
                return res.status(404).send(`Menu dengan nama '${namaMenu}' tidak ditemukan.`);
            }

            const menuData = menuSnapshot.docs[0].data();
            const { ingredients, harga } = menuData;

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
        const transactionId = await generateTransactionId(transactionDate, transactionDate);

        // Simpan record transaksi ke Firestore dengan format yang sesuai
        const transactionRecord = {
            transaction_date: transactionDate.toLocaleDateString(), // Gunakan tanggal saat ini
            transaction_time: transactionDate.toLocaleTimeString(), // Gunakan waktu saat ini
            unit_price: transactionItems[0].harga, // Harga satuan produk pertama dalam transaksi
            product_id: transactionItems[0].namaMenu, // ID produk pertama dalam transaksi
            quantity: transactionItems[0].quantity, // Jumlah produk pertama dalam transaksi
            line_item_amount: totalHarga, // Total harga transaksi
            transaction_id: transactionId // ID transaksi yang dihasilkan
        };

        // Simpan transaksi ke Firestore
        await db.collection('transactions').doc(transactionId).set(transactionRecord);

        // Response jika checkout berhasil
        res.status(200).json({ message: 'Checkout berhasil.', totalHarga, transactionId });
    } catch (error) {
        // Tangani error dengan respons status 500
        console.error('Error during checkout:', error);
        res.status(500).send(error.message);
    }
};

const upDataTestingTransaction = async (req, res) => {
    try {
        const { orderItems, transaction_date, transaction_time } = req.body;

        // Validasi orderItems, transaction_date, dan transaction_time
        if (!orderItems || !Array.isArray(orderItems) || orderItems.length === 0) {
            return res.status(400).send('Order items harus disertakan dan tidak boleh kosong.');
        }
        if (!transaction_date || !transaction_time) {
            return res.status(400).send('Transaction date dan transaction time harus disertakan.');
        }

        // Konversi transaction_date dan transaction_time menjadi objek Date
        const transactionDateParts = transaction_date.split('/');
        const day = parseInt(transactionDateParts[0], 10);
        const month = parseInt(transactionDateParts[1], 10) - 1; // Months are 0-indexed
        const year = parseInt(transactionDateParts[2], 10);
        const transactionTimeParts = transaction_time.split(':');
        const hours = parseInt(transactionTimeParts[0], 10);
        const minutes = parseInt(transactionTimeParts[1], 10);
        const seconds = parseInt(transactionTimeParts[2], 10);

        const dateObject = new Date(year, month, day, hours, minutes, seconds);

        let totalHarga = 0;
        let inventoryUpdates = [];
        let transactionItems = [];

        // Iterasi melalui setiap item dalam orderItems
        for (const item of orderItems) {
            const { namaMenu, quantity } = item;

            // Validasi ketersediaan menu
            const menuSnapshot = await db.collection('menu').where('namaMenu', '==', namaMenu).get();

            if (menuSnapshot.empty) {
                return res.status(404).send(`Menu dengan nama '${namaMenu}' tidak ditemukan.`);
            }

            const menuData = menuSnapshot.docs[0].data();
            const { ingredients, harga } = menuData;

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
        const transactionId = await generateTransactionId(dateObject, dateObject);

        // Simpan record transaksi ke Firestore dengan format yang sesuai
        const transactionRecord = {
            transaction_date: transaction_date,
            transaction_time: transaction_time,
            unit_price: transactionItems[0].harga, // Harga satuan produk pertama dalam transaksi
            product_id: transactionItems[0].namaMenu, // ID produk pertama dalam transaksi
            quantity: transactionItems[0].quantity, // Jumlah produk pertama dalam transaksi
            line_item_amount: totalHarga, // Total harga transaksi
            transaction_id: transactionId // ID transaksi yang dihasilkan
        };

        // Simpan transaksi ke Firestore
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
        const transactionDate = new Date(transactionData.transaction_date);
        const formattedDate = `${transactionDate.getDate()}/${transactionDate.getMonth() + 1}/${transactionDate.getFullYear()}`;
        const formattedTime = `${transactionDate.getHours()}:${transactionDate.getMinutes()}:${transactionDate.getSeconds()}`;

        // Cetak nota
        const nota = {
            tanggal: `${formattedDate} ${formattedTime}`, // Menggunakan format tanggal dan waktu yang sesuai
            idTransaksi: transactionData.transaction_id,
            items: transactionData.quantity, // Karena hanya ada satu produk dalam transaksi
            grandTotal: transactionData.line_item_amount // Menggunakan total harga dari transaksi
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

            // Ubah format tanggal dan waktu
            const transactionDate = transactionData.transaction_date;
            const transactionTime = transactionData.transaction_time;

            // Buat objek nota
            const nota = {
                transaction_date: transactionDate,
                transaction_time: transactionTime,
                unit_price: transactionData.unit_price,
                product_id: transactionData.product_id,
                quantity: transactionData.quantity,
                line_item_amount: transactionData.line_item_amount,
                transaction_id: transactionData.transaction_id
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
    upDataTestingTransaction,
    printReceipt,
    getAllReceipts,
    checkout
};
