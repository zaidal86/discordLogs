const { createCanvas } = require('canvas');
const fs = require('fs');
const GIFEncoder = require('gifencoder');

function createDualGaugeImage(value1, text1, additionalText1, value2, text2, additionalText2, data) {
    const canvas = createCanvas(800, 250);
    const ctx = canvas.getContext('2d');

    // Dessiner le rectangle vert en arrière-plan
    ctx.fillStyle = '#191919'; // Couleur verte
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Dessiner la première jauge (à gauche)
    drawGauge(ctx, value1, text1, additionalText1, 1);

    // Dessiner la deuxième jauge (à droite)
    drawGauge(ctx, value2, text2, additionalText2, 2);

    // Ajouter le texte
    ctx.font = '16px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const key in data) {
        ctx.textAlign = 'left';
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(`${key} : `, 220, data[key].height);

        ctx.textAlign = 'center';
        ctx.fillStyle = data[key].color();
        ctx.fillText(`${data[key].status}`, 420, data[key].height);
    }

    return canvas;
}

function drawGauge(ctx, value, text, additionalText, position) {
    const numGauges = 2;
    const gaugeWidth = ctx.canvas.width / (numGauges + 1);

    let centerX;

    if (position === 1) {
        centerX = gaugeWidth / 2.5; // La première jauge est à gauche
    } else if (position === 2) {
        centerX = gaugeWidth * 2.6; // La deuxième jauge est à droite
    }

    const centerY = ctx.canvas.height / 2;
    // tailles des cercles font + rainbow
    const radius = 80;

    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2, false);
    ctx.fillStyle = '#191919';
    ctx.fill();

    const emptyCircleRadius = radius - ctx.lineWidth / 20;
    ctx.beginPath();
    ctx.arc(centerX, centerY, emptyCircleRadius, 0, Math.PI * 2, false);
    ctx.strokeStyle = '#2D2D2D';
    ctx.lineWidth = 15;
    ctx.stroke();

    // Ajouter la couleur rainbow
    const hue = (1 - value / 100) * 120;
    ctx.strokeStyle = `hsl(${hue}, 100%, 50%)`;
    const startAngle = Math.PI * 1.5;
    const endAngle = startAngle + (value / 100) * (Math.PI * 2);
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, startAngle, endAngle, false);
    ctx.lineWidth = 15;
    ctx.stroke();

    // Ajouter le texte
    ctx.fillStyle = '#00FFD8';
    ctx.font = '16px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, centerX, centerY);
    ctx.font = '12px Arial';
    ctx.fillText(additionalText, centerX, centerY + 20);
}

function calculateRam(value, maxRam) {
    value = Math.max(0, Math.min(100, value));
    let ram = (value / 100) * maxRam;
    return ram === maxRam ? maxRam : ram.toFixed(1);
}

function generateGifFrames(value1, value2, data) {
    const frames = [];

    // Générer des frames pour l'évolution des jauges (par exemple, de 0 à 100)
    for (let i = 0; i <= 100; i += 10) {
        const canvas = createCanvas(800, 250);
        const gaugeValue1 = i * (value1 / 100);
        const gaugeValue2 = i * (value2 / 100);
        const gaugeCanvas = createDualGaugeImage(
            gaugeValue1,
            `${calculateRam(gaugeValue1, 2)}/2Go`,
            'Ram',
            gaugeValue2,
            `${calculateRam(gaugeValue2, 20)}/20Go`,
            'Disk',
            data
        );
        canvas.getContext('2d').drawImage(gaugeCanvas, 0, 0);
        frames.push(canvas);
    }

    return frames;
}

function createGif(frames, filename) {
    const encoder = new GIFEncoder(800, 250);
    const stream = fs.createWriteStream(filename);

    encoder.createReadStream().pipe(stream);
    encoder.start();
    encoder.setRepeat(-1);
    encoder.setDelay(60);

    // Ajout des frames à l'encodeur
    for (let i = 0; i < frames.length; i++) {
        encoder.addFrame(frames[i].getContext('2d'));
    }

    encoder.finish();
    console.log('GIF créé avec succès.');
}

// Fonction pour créer le GIF avec des valeurs personnalisées
function ramGauge(value1, value2, data) {
    const gifFrames = generateGifFrames(value1, value2, data);
    const gifFilename = `gaugeAnimation.gif`;
    createGif(gifFrames, gifFilename);
}

// Appel de la fonction avec des valeurs personnalisées
// ramGauge(75, 20);

module.exports = ramGauge;