const { Client, GatewayIntentBits } = require('discord.js');
const Tail = require('tail').Tail;
const os = require('os');
const diskusage = require('diskusage');
const dotenv = require('dotenv');
dotenv.config();
const util = require('util');
const execAsync = util.promisify(require('child_process').exec);
const ramGauge = require("./canvas.js");


const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildVoiceStates],
});

client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
    setupLogTail();
    setInterval(autosend, 60 * 1000)
});

client.login(process.env.TOKEN);

function formatUptime(uptimeInSeconds) {
    const days = Math.floor(uptimeInSeconds / (24 * 3600));
    const hours = Math.floor((uptimeInSeconds % (24 * 3600)) / 3600);
    const minutes = Math.floor((uptimeInSeconds % 3600) / 60);
    const seconds = Math.floor(uptimeInSeconds % 60);

    return `${days}j ${hours}h ${minutes}m ${seconds}s`;
}


function formatTimestamp(timestamp) {
    const date = new Date(timestamp);

    // Extraire les composants de la date
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0'); // Les mois sont indexés à partir de 0
    const year = date.getFullYear();

    // Construire la chaîne formatée
    const formattedTimestamp = `${hours}h${minutes}m${seconds}s : ${day}/${month}/${year}`;

    return formattedTimestamp;
}

function setupLogTail() {
    const tail = new Tail(process.env.LOGFILEPATCH);

    tail.on('line', (line) => {
        if (line.includes('sshd[') && line.includes('Accepted')) {
            // Détecte les lignes qui indiquent une connexion SSH acceptée
            const ipAddress = line.match(/from (\S+)/)[1];
            const userMatch = line.match(/(?:user|for) (\S+)/);
            const user = userMatch ? userMatch[1] : null;
            const timestampMatch = line.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}\+\d{2}:\d{2})/);
            const timestamp = timestampMatch ? timestampMatch[1] : null;


            const message = `Nouvelle connexion SSH : ${user} depuis ${ipAddress} à ${formatTimestamp(timestamp)} <@189428403349225472>`;
            sendMessageToDiscord(message, process.env.CHANNELID);
        }
    });

    tail.on('error', (error) => {
        console.error(`Erreur lors de la lecture du fichier : ${error}`);
    });
}

function sendMessageToDiscord(message, id) {
    const channel = client.channels.cache.get(id);

    if (channel) {
        channel.send(message);
    } else {
        console.error(`Le canal Discord avec l'ID ${process.env.CHANNELID} n'a pas été trouvé.`);
    }
}


const disk = async () => {
    try {
        const info = await diskusage.check('/');
        const totalDiskSpace = info.total / (1024 ** 3);
        const usedDiskSpace = (info.total - info.free) / (1024 ** 3);

        return {
            total: totalDiskSpace.toFixed(2),
            used: usedDiskSpace.toFixed(2)
        };
    } catch (error) {
        console.error('Erreur lors de la vérification de l\'espace disque :', error);
        return {
            total: '',
            used: ''
        };
    }
}

const service = async () => {
    try {
        // Utilisez Promise.all pour attendre que toutes les promesses soient résolues
        const [nginxResult, ufwResult, webResult] = await Promise.all([
            execAsync('sudo systemctl is-active nginx').catch(error => ({ stdout: 'inactive\n' })),
            execAsync('sudo systemctl is-active ufw').catch(error => ({ stdout: 'inactive\n' })),
            execAsync('sudo systemctl is-active webStart').catch(error => ({ stdout: 'inactive\n' }))
        ]);

        // Récupérez les résultats trimmés
        const nginxStatus = nginxResult.stdout.trim();
        const ufwStatus = ufwResult.stdout.trim();
        const webStatus = webResult.stdout.trim();

        return {
            nginx: nginxStatus,
            ufw: ufwStatus,
            web: webStatus
        };
    } catch (error) {
        console.error('Erreur lors de la vérification des services :', error);
        return {
            nginx: '',
            ufw: '',
            web: ''
        };
    }
};

const sleep = (ms) => {
    return new Promise((resolve) => setTimeout(resolve, ms));
};

const autosend = async () => {
    const uptimeInSeconds = os.uptime();
    const formattedUptime = formatUptime(uptimeInSeconds);

    const totalRAM = os.totalmem();
    const usedRAM = totalRAM - os.freemem();
    const percentageUsed = (usedRAM / totalRAM) * 100;

    const { total, used } = await disk();
    const disckpercentage = (used / total) * 100;
    const { nginx, ufw, web } = await service();

    const data = {
        Distro: {
            status: 'Debian GNU/Linux 12 (bookworm)',
            color: function () {
                return '#FFFFFF'
            },
            height: 70
        },
        Kernel: {
            status: 'Linux 6.1.0-13-cloud-amd64',
            color: function () {
                return '#FFFFFF'
            },
            height: 90
        },
        Uptime: {
            status: formattedUptime,
            color: function () {
                return '#FFFFFF'
            },
            height: 110
        },
        serviceNginx: {
            status: nginx,
            color: function () {
                return this.status === 'active' ? '#00FF04' : '#FF0000'
            },
            height: 130
        },
        serviceUFW: {
            status: ufw,
            color: function () {
                return this.status === 'active' ? '#00FF04' : '#FF0000'
            },
            height: 150
        },
        serviceWeb: {
            status: web,
            color: function () {
                return this.status === 'active' ? '#00FF04' : '#FF0000'
            },
            height: 170
        }
    }

    ramGauge(percentageUsed, disckpercentage, data);

    await sleep(1000);

    const messageId = process.env.VPSMESSAGE;
    const channel = client.channels.cache.get(process.env.VPSSTATUS);
    if (channel) {
        channel.messages.fetch(messageId)
            .then(message => {
                message.edit({ files: ["./gaugeAnimation.gif"] })
            })
            .catch(error => console.error('Erreur lors de la récupération du message :', error));
    } else {
        console.error('Canal non trouvé.');
    }

    // sendMessageToDiscord({ files: ["./gaugeAnimation.gif"] }, process.env.VPSSTATUS)
}


module.exports = client;