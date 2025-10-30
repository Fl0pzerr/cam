const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Créer le dossier videos s'il n'existe pas
const videosDir = path.join(__dirname, 'videos');
if (!fs.existsSync(videosDir)) {
    fs.mkdirSync(videosDir, { recursive: true });
}

// Configuration de Multer pour stocker les vidéos
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, videosDir);
    },
    filename: (req, file, cb) => {
        const uniqueName = `video_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.webm`;
        cb(null, uniqueName);
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 200 * 1024 * 1024 // Limite à 200MB
    }
});

// Servir les fichiers statiques (HTML)
app.use(express.static('public'));

// Servir les vidéos avec les bons headers
app.use('/videos', express.static(videosDir, {
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.webm')) {
            res.set('Content-Type', 'video/webm');
            res.set('Accept-Ranges', 'bytes');
        } else if (filePath.endsWith('.mp4')) {
            res.set('Content-Type', 'video/mp4');
            res.set('Accept-Ranges', 'bytes');
        }
    }
}));

// Route principale - téléprompter
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Route admin - gestion des vidéos
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Route pour uploader les vidéos
app.post('/upload', upload.single('video'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'Aucune vidéo uploadée' });
    }

    console.log('✅ Vidéo sauvegardée:', req.file.filename);
    console.log('   Taille:', (req.file.size / 1024 / 1024).toFixed(2), 'MB');
    
    res.json({
        success: true,
        filename: req.file.filename,
        path: req.file.path,
        size: req.file.size
    });
});

// Route pour lister les vidéos
app.get('/videos-list', (req, res) => {
    fs.readdir(videosDir, (err, files) => {
        if (err) {
            return res.status(500).json({ error: 'Erreur lecture dossier' });
        }
        
        const videoFiles = files.filter(f => f.endsWith('.webm') || f.endsWith('.mp4'));
        res.json({ videos: videoFiles });
    });
});

// Route corrigée pour la page admin
app.get('/videos', (req, res) => {
    fs.readdir(videosDir, (err, files) => {
        if (err) {
            return res.status(500).json({ error: 'Erreur lecture dossier' });
        }
        
        const videoFiles = files.filter(f => f.endsWith('.webm') || f.endsWith('.mp4'));
        res.json({ videos: videoFiles });
    });
});

// Route pour obtenir les infos d'une vidéo
app.get('/video-info/:filename', (req, res) => {
    const filePath = path.join(videosDir, req.params.filename);
    
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Vidéo non trouvée' });
    }
    
    const stats = fs.statSync(filePath);
    const date = new Date(stats.mtime).toLocaleString('fr-FR');
    
    res.json({
        size: stats.size,
        date: date,
        created: stats.birthtime
    });
});

// Route pour télécharger une vidéo spécifique (avec support mobile)
app.get('/download/:filename', (req, res) => {
    const filePath = path.join(videosDir, req.params.filename);
    
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Vidéo non trouvée' });
    }
    
    // Headers pour forcer le téléchargement sur mobile
    res.setHeader('Content-Type', 'video/webm');
    res.setHeader('Content-Disposition', `attachment; filename="${req.params.filename}"`);
    res.setHeader('Content-Length', fs.statSync(filePath).size);
    
    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
});

// Route de santé pour vérifier que le serveur fonctionne
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        videos: fs.readdirSync(videosDir).length,
        timestamp: new Date().toISOString()
    });
});

// Démarrer le serveur
app.listen(PORT, () => {
    console.log('=================================');
    console.log('✅ Serveur Téléprompter démarré !');
    console.log('=================================');
    console.log(`🌐 Port: ${PORT}`);
    console.log(`📁 Dossier vidéos: ${videosDir}`);
    console.log(`🎥 Interface: http://localhost:${PORT}`);
    console.log(`⚙️  Admin: http://localhost:${PORT}/admin`);
    console.log(`🔑 Mot de passe admin: vid123`);
    console.log('=================================');
});
