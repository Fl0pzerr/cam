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
        fileSize: 100 * 1024 * 1024 // Limite à 100MB
    }
});

// Servir les fichiers statiques (HTML)
app.use(express.static('public'));

// Route pour uploader les vidéos
app.post('/upload', upload.single('video'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'Aucune vidéo uploadée' });
    }

    console.log('Vidéo sauvegardée:', req.file.filename);
    
    res.json({
        success: true,
        filename: req.file.filename,
        path: req.file.path,
        size: req.file.size
    });
});

// Route pour lister les vidéos (optionnel)
app.get('/videos', (req, res) => {
    fs.readdir(videosDir, (err, files) => {
        if (err) {
            return res.status(500).json({ error: 'Erreur lecture dossier' });
        }
        
        const videoFiles = files.filter(f => f.endsWith('.webm'));
        res.json({ videos: videoFiles });
    });
});

// Route pour télécharger une vidéo spécifique (optionnel)
app.get('/videos/:filename', (req, res) => {
    const filePath = path.join(videosDir, req.params.filename);
    
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Vidéo non trouvée' });
    }
    
    res.download(filePath);
});

// Démarrer le serveur
app.listen(PORT, () => {
    console.log(`✅ Serveur démarré sur le port ${PORT}`);
    console.log(`📁 Dossier vidéos: ${videosDir}`);
});