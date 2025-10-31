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

// Middleware pour gérer les erreurs
app.use((err, req, res, next) => {
    console.error('Erreur serveur:', err);
    res.status(500).json({ error: 'Erreur serveur', details: err.message });
});

// Servir les fichiers statiques (HTML) - avec gestion d'erreur
app.use(express.static('public', {
    fallthrough: true,
    setHeaders: (res, path) => {
        res.set('Cache-Control', 'no-cache');
    }
}));

// Servir les vidéos avec les bons headers et gestion d'erreur
app.use('/videos', (req, res, next) => {
    const filePath = path.join(videosDir, req.path);
    
    // Vérifier si le fichier existe avant de le servir
    if (!fs.existsSync(filePath)) {
        console.log('❌ Fichier non trouvé:', filePath);
        return res.status(404).json({ error: 'Fichier non trouvé' });
    }
    
    // Headers appropriés
    if (req.path.endsWith('.webm')) {
        res.set('Content-Type', 'video/webm');
    } else if (req.path.endsWith('.mp4')) {
        res.set('Content-Type', 'video/mp4');
    }
    
    res.set('Accept-Ranges', 'bytes');
    res.set('Cache-Control', 'no-cache');
    
    next();
}, express.static(videosDir));

// Route principale - téléprompter
app.get('/', (req, res) => {
    const indexPath = path.join(__dirname, 'public', 'index.html');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.status(404).send('index.html non trouvé');
    }
});

// Route admin - gestion des vidéos
app.get('/admin', (req, res) => {
    const adminPath = path.join(__dirname, 'public', 'admin.html');
    if (fs.existsSync(adminPath)) {
        res.sendFile(adminPath);
    } else {
        res.status(404).send('admin.html non trouvé');
    }
});

// Route pour uploader les vidéos avec gestion d'erreur améliorée
app.post('/upload', (req, res) => {
    upload.single('video')(req, res, (err) => {
        if (err instanceof multer.MulterError) {
            console.error('❌ Erreur Multer:', err);
            return res.status(400).json({ 
                error: 'Erreur upload Multer', 
                details: err.message 
            });
        } else if (err) {
            console.error('❌ Erreur upload:', err);
            return res.status(500).json({ 
                error: 'Erreur upload', 
                details: err.message 
            });
        }

        if (!req.file) {
            return res.status(400).json({ error: 'Aucune vidéo uploadée' });
        }

        console.log('✅ Vidéo sauvegardée:', req.file.filename);
        console.log('   Taille:', (req.file.size / 1024 / 1024).toFixed(2), 'MB');
        
        res.json({
            success: true,
            filename: req.file.filename,
            path: `/videos/${req.file.filename}`,
            size: req.file.size
        });
    });
});

// Route pour lister les vidéos
app.get('/videos-list', (req, res) => {
    try {
        const files = fs.readdirSync(videosDir);
        const videoFiles = files.filter(f => f.endsWith('.webm') || f.endsWith('.mp4'));
        res.json({ videos: videoFiles });
    } catch (err) {
        console.error('❌ Erreur lecture dossier:', err);
        res.status(500).json({ error: 'Erreur lecture dossier', details: err.message });
    }
});

// Route pour la page admin (alias)
app.get('/videos', (req, res) => {
    try {
        const files = fs.readdirSync(videosDir);
        const videoFiles = files.filter(f => f.endsWith('.webm') || f.endsWith('.mp4'));
        res.json({ videos: videoFiles });
    } catch (err) {
        console.error('❌ Erreur lecture dossier:', err);
        res.status(500).json({ error: 'Erreur lecture dossier', details: err.message });
    }
});

// Route pour obtenir les infos d'une vidéo
app.get('/video-info/:filename', (req, res) => {
    try {
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
    } catch (err) {
        console.error('❌ Erreur info vidéo:', err);
        res.status(500).json({ error: 'Erreur info vidéo', details: err.message });
    }
});

// Route pour télécharger une vidéo spécifique
app.get('/download/:filename', (req, res) => {
    try {
        const filePath = path.join(videosDir, req.params.filename);
        
        if (!fs.existsSync(filePath)) {
            console.log('❌ Vidéo non trouvée pour téléchargement:', filePath);
            return res.status(404).json({ error: 'Vidéo non trouvée' });
        }
        
        const stats = fs.statSync(filePath);
        
        // Headers pour forcer le téléchargement
        res.setHeader('Content-Type', 'video/webm');
        res.setHeader('Content-Disposition', `attachment; filename="${req.params.filename}"`);
        res.setHeader('Content-Length', stats.size);
        res.setHeader('Accept-Ranges', 'bytes');
        
        const stream = fs.createReadStream(filePath);
        
        stream.on('error', (err) => {
            console.error('❌ Erreur lecture stream:', err);
            if (!res.headersSent) {
                res.status(500).json({ error: 'Erreur lecture vidéo' });
            }
        });
        
        stream.pipe(res);
    } catch (err) {
        console.error('❌ Erreur téléchargement:', err);
        res.status(500).json({ error: 'Erreur téléchargement', details: err.message });
    }
});

// Route de santé pour vérifier que le serveur fonctionne
app.get('/health', (req, res) => {
    try {
        const videoCount = fs.readdirSync(videosDir).length;
        res.json({ 
            status: 'ok', 
            videos: videoCount,
            timestamp: new Date().toISOString(),
            videosDir: videosDir
        });
    } catch (err) {
        res.status(500).json({ 
            status: 'error', 
            error: err.message 
        });
    }
});

// Gestion des routes non trouvées
app.use((req, res) => {
    console.log('❌ Route non trouvée:', req.path);
    res.status(404).json({ error: 'Route non trouvée', path: req.path });
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
