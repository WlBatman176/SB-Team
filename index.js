const { 
    Client, GatewayIntentBits, Partials, PermissionsBitField, 
    EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, RoleSelectMenuBuilder, AuditLogEvent,
    StringSelectMenuBuilder,ChannelType
} = require("discord.js");
const fs = require("fs");
const path = require("path");
const ms = require('ms');

const PREFIX = "+";
const TOKEN = process.env.DISCORD_BOT_TOKEN; 
const BOT_OWNER_ID = "1402150731317903373"; 

// Fichiers de stockage - Modifie ce chemin vers un dossier persistant si nécessaire
const DATA_DIR = "./data";

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR);
}

const CONFIG_FILE = path.join(DATA_DIR, "config.json");
const SANCTIONS_FILE = path.join(DATA_DIR, "sanctions.json");
const WHITELIST_FILE = path.join(DATA_DIR, "whitelist.json");
const TICKETS_FILE = path.join(DATA_DIR, "tickets.json");
const BLRANK_FILE = path.join(DATA_DIR, "blrank.json");
const WLSALON_FILE = path.join(DATA_DIR, "wlsalon.json");
const OWN_FILE = path.join(DATA_DIR, "own.json");
const CLAIMED_FILE = path.join(DATA_DIR, "claimed.json");

const GIVEAWAY_BYPASS_ROLE = "1496455010895007897";


function loadJSON(file) {
    if (!fs.existsSync(file)) fs.writeFileSync(file, "{}");
    try {
        return JSON.parse(fs.readFileSync(file));
    } catch {
        fs.writeFileSync(file, "{}");
        return {};
    }
}

const claimedTickets = new Map(Object.entries(loadJSON(CLAIMED_FILE)));

function saveJSON(file, data) {
    fs.writeFileSync(file, JSON.stringify(data, null, 4));
}

function getIdFromMentionOrId(value) {
    if (!value) return null;
    return value.toString().replace(/[<@!&>]/g, "");
}

function getRepliedUserId(message) {
    return message?.mentions?.repliedUser?.id || null;
}

function getTargetId(message, value) {
    const repliedId = getRepliedUserId(message);
    const explicitMention = message?.mentions?.users?.find(u => u.id !== repliedId);
    if (explicitMention) return explicitMention.id;
    const id = getIdFromMentionOrId(value);
    if (id) return id;
    return repliedId;
}

async function getMemberFromMentionOrId(message, value) {
    const repliedId = getRepliedUserId(message);
    const explicitMention = message.mentions.members.find(m => m.id !== repliedId);
    if (explicitMention) return explicitMention;
    const id = getIdFromMentionOrId(value);
    if (id) {
        return message.guild.members.cache.get(id) || await message.guild.members.fetch(id).catch(() => null);
    }
    if (repliedId) {
        return message.guild.members.cache.get(repliedId) || await message.guild.members.fetch(repliedId).catch(() => null);
    }
    return null;
}

function isWhitelisted(guildId, userId) {
    return userId === BOT_OWNER_ID || (whitelist[guildId] && whitelist[guildId].includes(userId));
}

function hasModerationPerms(message) {
    return message.member.permissions.has(PermissionsBitField.Flags.MuteMembers) ||
        message.member.permissions.has(PermissionsBitField.Flags.ManageRoles) ||
        message.member.permissions.has(PermissionsBitField.Flags.KickMembers) ||
        message.member.permissions.has(PermissionsBitField.Flags.ManageGuild);
}

function parsePermLevel(name) {
    let s = name.toLowerCase().replace(/\s+/g, "");

    s = s.replace(/[\u2160-\u217f]/g, (ch) => {
        const code = ch.charCodeAt(0);
        const romans = ["i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x", "xi", "xii"];
        if (code >= 0x2160 && code <= 0x216b) return romans[code - 0x2160];
        if (code >= 0x2170 && code <= 0x217b) return romans[code - 0x2170];
        return ch;
    });

    s = s.replace(/^(perm|p)/, "");

    if (/^[1-9]$/.test(s)) return parseInt(s, 10);

    const asciiRomans = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9 };
    if (asciiRomans[s] !== undefined) return asciiRomans[s];

    return null;
}

function getHighestPermLevel(message) {
    const member = message.member || message;
    if (!member || !member.roles) return 0;

    let maxLevel = 0;
    for (const role of member.roles.cache.values()) {
        const level = parsePermLevel(role.name);
        if (level && level > maxLevel) maxLevel = level;
    }
    return maxLevel;
}

function hasPermLevel(message, level) {
    return getHighestPermLevel(message) >= level;
}

function hasExactPermLevel(message, level) {
    return getHighestPermLevel(message) === level;
}

function hasGiveawayBypass(message) {
    if (!message.member || !message.member.roles) return false;
    return message.member.roles.cache.has(GIVEAWAY_BYPASS_ROLE);
}

function canUseCommand(message, def) {
    if (def.strict) return def.allow(message);
    return def.allow(message) || isWhitelisted(message.guild.id, message.author.id);
}

const commandDefinitions = {
    help: { category: "Public", label: "+help", description: "Voir la page d'aide", allow: () => true },
    ticket: { category: "Ticket", label: "+ticket", description: "Envoyer le panel ticket", allow: (message) => isWhitelisted(message.guild.id, message.author.id) && getHighestPermLevel(message) < 10 },
    close: { category: "Ticket", label: "+close", description: "Fermer un ticket", allow: (message) => {
        const CLOSE_ALLOWED_ROLES = [
            "1496454005302362132",
            "1496454153310834718",
            "1485915612831154308",
            "1485916863522144426",
            "1489677864793149702"
        ];
        return message.member.roles.cache.some(r => CLOSE_ALLOWED_ROLES.includes(r.id));
    } },
    userinfo: { category: "Public", label: "+userinfo", description: "Afficher les informations d'un utilisateur", allow: () => true },
    pic: { category: "Public", label: "+pic", description: "Afficher la photo de profil d'un utilisateur", allow: () => true },
    find: { category: "Public", label: "+find", description: "Trouver un utilisateur vocal", allow: (message) => isWhitelisted(message.guild.id, message.author.id) },
    serverinfo: { category: "Public", label: "+serverinfo", description: "Afficher les informations du serveur", allow: () => true },
    perms: { category: "Public", label: "+perms", description: "Voir les rôles de permission et leur numéro", allow: () => true },
    stats: { category: "Public", label: "+stats", description: "Créer / mettre à jour les salons de stats", allow: (message) => isWhitelisted(message.guild.id, message.author.id) },
    snipe: { category: "Public", label: "+snipe", description: "Afficher le dernier message supprimé du salon", allow: () => true },
    warn: { category: "Sanction", label: "+warn", description: "Avertir un membre", allow: (message) => hasPermLevel(message, 1) },
    sanctions: { category: "Sanction", label: "+sanctions", description: "Voir les sanctions d'un membre", allow: (message) => hasPermLevel(message, 1) || isWhitelisted(message.guild.id, message.author.id) },
    ban: { category: "Sanction", label: "+ban", description: "Bannir un membre", allow: (message) => hasPermLevel(message, 9) },
    unban: { category: "Sanction", label: "+unban", description: "Débannir un membre", allow: (message) => hasPermLevel(message, 9) },
    banlist: { category: "Sanction", label: "+banlist", description: "Lister tous les membres bannis", allow: (message) => hasPermLevel(message, 8) || isWhitelisted(message.guild.id, message.author.id) },
    baninfo: { category: "Sanction", label: "+baninfo", description: "Afficher la raison du ban d'un membre", allow: (message) => hasPermLevel(message, 6) || isWhitelisted(message.guild.id, message.author.id) },
    kick: { category: "Sanction", label: "+kick", description: "Expulser un membre", allow: (message) => hasPermLevel(message, 9) },
    tempmute: { category: "Sanction", label: "+tempmute", description: "Muter un membre", allow: (message) => hasPermLevel(message, 2) || isWhitelisted(message.guild.id, message.author.id) },
    muteinfo: { category: "Sanction", label: "+muteinfo", description: "Afficher la raison du mute d'un membre", allow: (message) => hasPermLevel(message, 2) || isWhitelisted(message.guild.id, message.author.id) },
    unmute: { category: "Sanction", label: "+unmute", description: "Unmuter un membre", allow: (message) => hasPermLevel(message, 7) || isWhitelisted(message.guild.id, message.author.id) },
    mutelist: { category: "Sanction", label: "+mutelist", description: "Lister tous les membres mute", allow: (message) => hasPermLevel(message, 4) || isWhitelisted(message.guild.id, message.author.id) },
    rolemembers: { category: "Sanction", label: "+rolemembers", description: "Lister les membres qui ont un rôle", allow: (message) => hasPermLevel(message, 4) || isWhitelisted(message.guild.id, message.author.id) },
    bl: { category: "Sanction", label: "+bl", description: "Banliste un membre", strict: true, allow: (message) => isWhitelisted(message.guild.id, message.author.id) },
    unbl: { category: "Sanction", label: "+unbl", description: "Retirer un membre de la banlist", strict: true, allow: (message) => isWhitelisted(message.guild.id, message.author.id) },
    addrole: { category: "Sanction", label: "+addrole", description: "Ajouter un rôle à un membre", allow: (message) => hasPermLevel(message, 8) },
    delrole: { category: "Sanction", label: "+delrole", description: "Retirer un rôle d'un membre", allow: (message) => hasPermLevel(message, 8) },
    derank: { category: "Sanction", label: "+derank", description: "Retirer tous les rôles d'un membre", allow: (message) => hasPermLevel(message, 8) },
    clear: { category: "Sanction", label: "+clear", description: "Supprimer des messages", allow: (message) => hasPermLevel(message, 6) },
    welcome: { category: "Configuration", label: "+welcome", description: "Configurer le salon de bienvenue", allow: (message) => hasExactPermLevel(message, 9) },
    autorole: { category: "Configuration", label: "+autorole", description: "Configurer l'autorole", allow: (message) => hasExactPermLevel(message, 9) },
    giveaway: { category: "Configuration", label: "+giveaway", description: "Lancer un giveaway", allow: (message) => (message.member.permissions.has(PermissionsBitField.Flags.ManageChannels) && hasExactPermLevel(message, 9)) || hasGiveawayBypass(message) },
    reroll: { category: "Configuration", label: "+reroll", description: "Relancer un giveaway", allow: (message) => (message.member.permissions.has(PermissionsBitField.Flags.ManageChannels) || isWhitelisted(message.guild.id, message.author.id)) && hasExactPermLevel(message, 9) },
    wl: { category: "Configuration", label: "+wl", description: "Ajouter un utilisateur à la whitelist", allow: (message) => message.author.id === BOT_OWNER_ID },
    unwl: { category: "Configuration", label: "+unwl", description: "Retirer un utilisateur de la whitelist", allow: (message) => message.author.id === BOT_OWNER_ID },
    renew: { category: "Configuration", label: "+renew", description: "Recréer le salon identiquement", allow: (message) => hasPermLevel(message, 9) || isWhitelisted(message.guild.id, message.author.id) },
    blrank: { category: "Sanction", label: "+blrank", description: "Blrank un membre (retire ses rôles et bloque tout nouveau rôle)", allow: (message) => hasPermLevel(message, 9) || isWhitelisted(message.guild.id, message.author.id) },
    unblrank: { category: "Sanction", label: "+unblrank", description: "Retirer un membre du blrank", allow: (message) => hasPermLevel(message, 9) || isWhitelisted(message.guild.id, message.author.id) },
    hide: { category: "Configuration", label: "+hide", description: "Rendre le salon privé", allow: (message) => hasPermLevel(message, 9) || isWhitelisted(message.guild.id, message.author.id) },
    unhide: { category: "Configuration", label: "+unhide", description: "Rendre le salon public", allow: (message) => hasPermLevel(message, 9) || isWhitelisted(message.guild.id, message.author.id) },
    lock: { category: "Configuration", label: "+lock", description: "Empêcher @everyone d'écrire dans le salon", allow: (message) => hasPermLevel(message, 9) || isWhitelisted(message.guild.id, message.author.id) },
    unlock: { category: "Configuration", label: "+unlock", description: "Autoriser de nouveau @everyone à écrire dans le salon", allow: (message) => hasPermLevel(message, 9) || isWhitelisted(message.guild.id, message.author.id) },
    "create": { category: "Public", label: "+create emojis", description: "Créer un emoji", allow: (message) => isWhitelisted(message.guild.id, message.author.id) },
    allbots: { category: "Configuration", label: "+allbots", description: "Lister tous les bots du serveur", allow: (message) => hasPermLevel(message, 9) || isWhitelisted(message.guild.id, message.author.id) },
    rename: { category: "Configuration", label: "+rename", description: "Renommer un salon ticket", allow: (message) => hasPermLevel(message, 9) || isWhitelisted(message.guild.id, message.author.id) },
    helpall: { category: "Public", label: "+helpall", description: "Afficher les commandes groupées par permission", allow: () => true },
    wlsalon: { category: "Configuration", label: "+wlsalon", description: "Autoriser un utilisateur à créer/supprimer des salons", allow: (message) => message.author.id === BOT_OWNER_ID },
    unwlsalon: { category: "Configuration", label: "+unwlsalon", description: "Retirer un utilisateur du wlsalon", allow: (message) => message.author.id === BOT_OWNER_ID },
    own: { category: "Configuration", label: "+own", description: "Autoriser un utilisateur à bannir hors du bot", allow: (message) => message.author.id === BOT_OWNER_ID },
    unown: { category: "Configuration", label: "+unown", description: "Retirer un utilisateur de la liste own", allow: (message) => message.author.id === BOT_OWNER_ID },
    regle: { category: "Configuration", label: "+regle", description: "Envoyer le règlement du serveur", allow: (message) => message.author.id === BOT_OWNER_ID }
};

function getAccessibleCommands(message) {
    const categories = {};
    for (const def of Object.values(commandDefinitions)) {
        if (!canUseCommand(message, def)) continue;
        if (!categories[def.category]) categories[def.category] = [];
        categories[def.category].push(def.label);
    }
    return categories;
}

let config = loadJSON(CONFIG_FILE);
let sanctions = loadJSON(SANCTIONS_FILE);
let whitelist = loadJSON(WHITELIST_FILE);
let tickets = loadJSON(TICKETS_FILE);
let blrankList = loadJSON(BLRANK_FILE);
let wlsalonList = loadJSON(WLSALON_FILE);
let ownList = loadJSON(OWN_FILE);
const activeGiveaways = {};
const activeStats = {};
const statsIntervals = {};
const snipedMessages = new Map();

function saveConfig() { saveJSON(CONFIG_FILE, config); }
function saveSanctions() { saveJSON(SANCTIONS_FILE, sanctions); }
function saveWhitelist() { saveJSON(WHITELIST_FILE, whitelist); }
function saveTickets() { saveJSON(TICKETS_FILE, tickets); }
function saveBlrank() { saveJSON(BLRANK_FILE, blrankList); }
function saveWlsalon() { saveJSON(WLSALON_FILE, wlsalonList); }
function saveOwn() { saveJSON(OWN_FILE, ownList); }

function isOwn(guildId, userId) {
    if (userId === BOT_OWNER_ID) return true;
    return Array.isArray(ownList[guildId]) && ownList[guildId].includes(userId);
}

function addOwn(guildId, userId) {
    if (!Array.isArray(ownList[guildId])) ownList[guildId] = [];
    if (!ownList[guildId].includes(userId)) {
        ownList[guildId].push(userId);
        saveOwn();
        return true;
    }
    return false;
}

function removeOwn(guildId, userId) {
    if (!Array.isArray(ownList[guildId])) return false;
    const before = ownList[guildId].length;
    ownList[guildId] = ownList[guildId].filter(id => id !== userId);
    if (ownList[guildId].length !== before) {
        saveOwn();
        return true;
    }
    return false;
}

function isWlsalon(guildId, userId) {
    if (userId === BOT_OWNER_ID) return true;
    return Array.isArray(wlsalonList[guildId]) && wlsalonList[guildId].includes(userId);
}

function addWlsalon(guildId, userId) {
    if (!Array.isArray(wlsalonList[guildId])) wlsalonList[guildId] = [];
    if (!wlsalonList[guildId].includes(userId)) {
        wlsalonList[guildId].push(userId);
        saveWlsalon();
        return true;
    }
    return false;
}

function removeWlsalon(guildId, userId) {
    if (!Array.isArray(wlsalonList[guildId])) return false;
    const before = wlsalonList[guildId].length;
    wlsalonList[guildId] = wlsalonList[guildId].filter(id => id !== userId);
    if (wlsalonList[guildId].length !== before) {
        saveWlsalon();
        return true;
    }
    return false;
}

function isBlranked(guildId, userId) {
    return Array.isArray(blrankList[guildId]) && blrankList[guildId].includes(userId);
}

function addBlrank(guildId, userId) {
    if (!Array.isArray(blrankList[guildId])) blrankList[guildId] = [];
    if (!blrankList[guildId].includes(userId)) {
        blrankList[guildId].push(userId);
        saveBlrank();
    }
}

function removeBlrank(guildId, userId) {
    if (!Array.isArray(blrankList[guildId])) return false;
    const before = blrankList[guildId].length;
    blrankList[guildId] = blrankList[guildId].filter(id => id !== userId);
    if (blrankList[guildId].length !== before) {
        saveBlrank();
        return true;
    }
    return false;
}

const TICKET_PARENT_CATEGORY_NAME = "🌎➔ Espace assistance < ❓";

const TICKET_STAFF_ROLES = {
    "Ticket Owner": "1489677864793149702",
    "Ticket GS": "1485915612831154308",
    "Ticket GAP": "1485916863522144426"
};

async function placeCategoryBelowReference(guild, category) {
    const reference = guild.channels.cache.find(
        c => c.type === ChannelType.GuildCategory && c.name === TICKET_PARENT_CATEGORY_NAME
    );
    if (!reference) return;

    const categories = [...guild.channels.cache
        .filter(c => c.type === ChannelType.GuildCategory)
        .values()]
        .sort((a, b) => a.rawPosition - b.rawPosition);

    const refIdx = categories.findIndex(c => c.id === reference.id);
    const curIdx = categories.findIndex(c => c.id === category.id);
    if (refIdx === -1 || curIdx === -1) return;

    const targetIdx = refIdx + 1;
    if (curIdx === targetIdx) return;

    await category.setPosition(targetIdx).catch(() => {});
}

async function getOrCreateTicketCategory(guild, name, staffRoleId) {
    let category = guild.channels.cache.find(
        c => c.type === ChannelType.GuildCategory && c.name === name
    );

    const overwrites = [
        {
            id: guild.roles.everyone,
            deny: [PermissionsBitField.Flags.ViewChannel],
        },
    ];
    if (staffRoleId) {
        overwrites.push({
            id: staffRoleId,
            allow: [
                PermissionsBitField.Flags.ViewChannel,
                PermissionsBitField.Flags.SendMessages,
                PermissionsBitField.Flags.ReadMessageHistory,
            ],
        });
    }

    if (!category) {
        category = await guild.channels.create({
            name,
            type: ChannelType.GuildCategory,
            permissionOverwrites: overwrites,
        });
    } else if (staffRoleId && !category.permissionOverwrites.cache.has(staffRoleId)) {
        await category.permissionOverwrites.edit(staffRoleId, {
            ViewChannel: true,
            SendMessages: true,
            ReadMessageHistory: true,
        }).catch(() => {});
    }

    await placeCategoryBelowReference(guild, category);
    return category;
}

function sanitizeChannelName(value) {
    if (!value) return "";
    return value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

function getTicketChannelName(user) {
    const rawName = `${user.username}-${user.discriminator}`;
    const sanitized = sanitizeChannelName(rawName);
    return `ticket-${sanitized || user.id}`;
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildPresences
    ],
    partials: [Partials.Channel, Partials.Message]
});

client.once("ready", async () => {
    console.log(`Connecté en tant que ${client.user.tag}`);

    // Restart stats intervals for guilds that had them active
    for (const [guildId, guild] of client.guilds.cache) {
        if (config[guildId]?.statsActive) {
            try {
                const category = await ensureStatsCategory(guild);
                const statsChannels = await ensureStatsChannels(guild, category);
                activeStats[guildId] = statsChannels;
                statsIntervals[guildId] = setInterval(async () => {
                    const g = client.guilds.cache.get(guildId);
                    if (!g) {
                        clearInterval(statsIntervals[guildId]);
                        delete statsIntervals[guildId];
                        delete activeStats[guildId];
                        config[guildId].statsActive = false;
                        saveConfig();
                        return;
                    }
                    const cat = await ensureStatsCategory(g);
                    const channels = await ensureStatsChannels(g, cat);
                    activeStats[guildId] = channels;
                }, 5000); // Mise à jour toutes les 5 secondes
                console.log(`Stats restarted for guild ${guildId}`);
            } catch (error) {
                console.error(`Failed to restart stats for guild ${guildId}:`, error);
            }
        }
    }
});
// ================ COMMANDES MESSAGE =================
const PUBLIC_COMMANDS = new Set(["help", "userinfo", "pic", "snipe", "serverinfo", "perms", "helpall"]);
const DISCORD_INVITE_ALLOWED_CHANNEL = "1488946919316394095";
const DISCORD_INVITE_REGEX = /(?:https?:\/\/)?(?:www\.)?discord\.gg\/\S+/i;

client.on("messageCreate", async (message) => {
    if (message.author.bot) return;

    if (
        message.guild &&
        message.channel?.id !== DISCORD_INVITE_ALLOWED_CHANNEL &&
        DISCORD_INVITE_REGEX.test(message.content) &&
        message.author.id !== BOT_OWNER_ID
    ) {
        const me = message.guild.members.me;
        if (me?.permissionsIn(message.channel)?.has(PermissionsBitField.Flags.ManageMessages)) {
            await message.delete().catch(() => {});
            message.channel.send(`${message.author}, les invitations Discord ne sont pas autorisées ici`).then(m => setTimeout(() => m.delete().catch(() => {}), 5000)).catch(() => {});
            return;
        }
    }

    if (client.user && message.mentions.has(client.user) && !message.mentions.everyone) {
        const onlyMention = /^<@!?\d+>\s*$/.test(message.content.trim());
        const startsWithMention = new RegExp(`^<@!?${client.user.id}>`).test(message.content.trim());
        if (onlyMention || startsWithMention) {
            message.reply(`mon prefix est **${PREFIX}**`).catch(() => {});
        }
    }

    if (!message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    if (message.guild && !PUBLIC_COMMANDS.has(command) && !isWhitelisted(message.guild.id, message.author.id) && !hasGiveawayBypass(message)) {
        return message.reply("tu nest pas autoriser à utiliser cette commande");
    }

    if (command === "create" && args[0] === "emojis") {
        if (!isWhitelisted(message.guild.id, message.author.id)) {
            return message.reply("tu nest pas autoriser à user cette commande");
        }

        const emojiInputs = args.slice(1); // Récupère tous les arguments après 'emojis'
        if (emojiInputs.length === 0) {
            return message.reply("met au moins un emoji à copier");
        }

        const addedEmojis = [];
        const failedEmojis = [];

        for (const emojiInput of emojiInputs) {
            const emojiRegex = /<a?:(\w+):(\d+)>/;
            const match = emojiInput.match(emojiRegex);
            if (!match) {
                failedEmojis.push(emojiInput);
                continue;
            }

            const emojiName = match[1].replace(/[^a-zA-Z0-9_]/g, "").toLowerCase(); // Nettoyage du nom
            const emojiId = match[2];
            const emojiURL = `https://cdn.discordapp.com/emojis/${emojiId}.${emojiInput.startsWith('<a:') ? 'gif' : 'png'}`; // Format correct

            try {
                const newEmoji = await message.guild.emojis.create({ attachment: emojiURL, name: emojiName });
                addedEmojis.push(newEmoji.toString());
            } catch (error) {
                console.error(`Erreur lors de l'ajout de l'emoji ${emojiInput}:`, error);
                failedEmojis.push(emojiInput);
            }
        }

        let replyMessage = "";
        if (addedEmojis.length > 0) {
            replyMessage += `Emojis ajoutés avec succès : ${addedEmojis.join(", ")}`;
        }
        if (failedEmojis.length > 0) {
            replyMessage += `\nÉchec pour les emojis suivants : ${failedEmojis.join(", ")}`;
        }

        message.reply(replyMessage);
    }

    if (command === "add") command = 'addrole';
    if (command === 'remove') command = 'delrole';

    const def = commandDefinitions[command];
    if (def && !canUseCommand(message, def)) {
        return message.reply("Tu n'as pas la perm d'utiliser cette commande");
    }

    // ================= HELP =================
    if (command === "help") {
        const categories = getAccessibleCommands(message);
        const helpEmbed = new EmbedBuilder()
            .setTitle("Page d'aide")
            .setDescription("Permet de voir la liste des commandes en fonction de vos permissions sur le bot")
            .setColor("#5865f2");

        for (const [category, commands] of Object.entries(categories)) {
            helpEmbed.addFields({ name: category, value: commands.join(" "), inline: false });
        }

        if (Object.keys(categories).length === 0) {
            helpEmbed.setDescription("Aucune commande disponible pour tes perm");
        }

        return message.channel.send({ embeds: [helpEmbed] });
    }

    if (command === "helpall") {
        const helpallByLevel = {
            1: ["warn", "perms", "helpall", "sanctions"],
            2: ["tempmute", "muteinfo"],
            3: [],
            4: ["rolemembers", "mutelist"],
            5: [],
            6: ["baninfo", "clear"],
            7: ["unmute"],
            8: ["delrole", "addrole", "banlist", "derank"],
            9: ["hide", "allbots", "lock", "unhide", "unlock", "renew", "ban", "rename", "blrank", "unban"]
        };

        const helpallEmbed = new EmbedBuilder()
            .setTitle("# Permissions liées aux commandes")
            .setDescription("> Voici les différentes permissions ainsi que les commandes accessibles")
            .setColor("#5865f2");

        for (let i = 1; i <= 9; i++) {
            const cmds = helpallByLevel[i];
            helpallEmbed.addFields({
                name: `**Permission ${i}**`,
                value: `> ↳ ${cmds.length ? cmds.join(", ") : "Aucune commande"}`
            });
        }

        return message.channel.send({ embeds: [helpallEmbed] });
    }

if (command === "perms") {

    const getRole = (name) =>
        message.guild.roles.cache.find(
            r => r.name.toLowerCase() === name.toLowerCase()
        );

    const format = (roles) =>
        roles
            .map(r => (r ? `<@&${r.id}>` : null))
            .filter(Boolean)
            .join(" , ");

    const embed = new EmbedBuilder()
        .setTitle("# Permissions")
        .setDescription("> Voici les différentes permissions ainsi que les rôles accessibles")
        .setColor("#5865f2");

    embed.addFields(
        {
            name: "**Permission 1**",
            value: `> ↳ ${format([getRole("Perm Ⅰ")])}`,
        },
        {
            name: "**Permission 2**",
            value: `> ↳ ${format([getRole("Perm ⅠⅠ")])}`,
        },
        {
            name: "**Permission 3**",
            value: `> ↳ ${format([getRole("Perm ⅠⅠⅠ")])}`,
        },
        {
            name: "**Permission 4**",
            value: `> ↳ ${format([getRole("Perm ⅠⅤ")])}`,
        },
        {
            name: "**Permission 5**",
            value: `> ↳ ${format([getRole("Perm Ⅴ")])}`,
        },
        {
            name: "**Permission 6**",
            value: `> ↳ ${format([getRole("Prestige")])}`,
        },
        {
            name: "**Permission 7**",
            value: `> ↳ ${format([getRole("Apex"), getRole("L’Élu")])}`,
        },
        {
            name: "**Permission 8**",
            value: `> ↳ ${format([getRole("神 (Kami)"), getRole("∞")])}`,
        },
        {
            name: "**Permission 9**",
            value: `> ↳ ${format([getRole("幽 (Yū)"), getRole("天 (Ten)")])}`,
        }
    );

    return message.channel.send({ embeds: [embed] });
}
    if (command === "renew") {
        if (!hasPermLevel(message, 9) && !isWhitelisted(message.guild.id, message.author.id)) {
            return message.reply("ta pas la perm pour cette cmd");
        }
        const channel = message.channel;
        const channelData = {
            name: channel.name,
            type: channel.type,
            parent: channel.parentId,
            position: channel.position,
            permissionOverwrites: channel.permissionOverwrites.cache.map(overwrite => ({
                id: overwrite.id,
                allow: overwrite.allow.toArray(),
                deny: overwrite.deny.toArray(),
                type: overwrite.type
            }))
        };
        await message.reply("Salon en cours de recréation");
        setTimeout(async () => {
            await channel.delete();
            await message.guild.channels.create(channelData);
        }, 1000);
    }

    if (command === "blrank") {
        if (!hasPermLevel(message, 9) && !isWhitelisted(message.guild.id, message.author.id)) {
            return message.reply("ta pas la perm pour cette cmd");
        }
        const user = await getMemberFromMentionOrId(message, args[0]);
        if (!user) return message.reply("Mentionne un utilisateur ou donne son ID");
        if (user.id === message.author.id) return message.reply("Tu ne peux pas te blrank toi-même");
        if (user.roles.highest.position >= message.member.roles.highest.position) return message.reply("Tu ne peux pas blrank quelqu'un avec un rôle supérieur");

        addBlrank(message.guild.id, user.id);

        const rolesToRemove = user.roles.cache.filter(role => role.id !== message.guild.id && !role.managed);
        if (rolesToRemove.size > 0) {
            await user.roles.remove(rolesToRemove).catch(() => {});
        }

        const removedList = rolesToRemove.size > 0 ? rolesToRemove.map(r => r.name).join(", ") : "aucun";
        message.reply(`${user.user.tag} est maintenant blrank Chaque rôle qu'il recevra sera retiré automatiquement Rôles retirés : ${removedList}`);

        const logsChannel = await ensureLogs(message.guild, "blrank");
        logsChannel.send({ embeds: [new EmbedBuilder().setTitle("Blrank")
            .setDescription(`Utilisateur: ${user.user.tag}\nModérateur: ${message.author.tag}\nRôles retirés: ${removedList}\nDate: ${new Date().toLocaleString()}`)
            .setColor("#ed4245")] });
    }

    if (command === "unblrank") {
        if (!hasPermLevel(message, 9) && !isWhitelisted(message.guild.id, message.author.id)) {
            return message.reply("ta pas la perm pour cette cmd");
        }
        const userId = getTargetId(message, args[0]);
        if (!userId) return message.reply("Mentionne un utilisateur ou donne son ID");

        const removed = removeBlrank(message.guild.id, userId);
        if (!removed) return message.reply(`<@${userId}> n'est pas blrank`);

        const member = await message.guild.members.fetch(userId).catch(() => null);
        const tag = member ? member.user.tag : userId;
        message.reply(`${tag} n'est plus blrank Il peut de nouveau recevoir des rôles`);

        const logsChannel = await ensureLogs(message.guild, "blrank");
        logsChannel.send({ embeds: [new EmbedBuilder().setTitle("Unblrank")
            .setDescription(`Utilisateur: ${tag}\nModérateur: ${message.author.tag}\nDate: ${new Date().toLocaleString()}`)
            .setColor("#57f287")] });
    }

    if (command === "hide") {
        if (!hasPermLevel(message, 9) && !isWhitelisted(message.guild.id, message.author.id)) return message.reply("ta pas la perm pour cette cmd");
        await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { ViewChannel: false });
        message.reply("Salon rendu privé");
    }

    if (command === "unhide") {
        if (!hasPermLevel(message, 9) && !isWhitelisted(message.guild.id, message.author.id)) return message.reply("ta pas la perm pour cette cmd");
        await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { ViewChannel: true });
        message.reply("Salon rendu public");
    }

    if (command === "lock") {
        if (!hasPermLevel(message, 9) && !isWhitelisted(message.guild.id, message.author.id)) {
            return message.reply("ta pas la perm pour cette cmd");
        }
        try {
            await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, {
                SendMessages: false,
                SendMessagesInThreads: false,
                AddReactions: false,
                CreatePublicThreads: false,
                CreatePrivateThreads: false
            });
            message.reply("Salon lock");
            const logsChannel = await ensureLogs(message.guild, "lock");
            logsChannel.send({ embeds: [new EmbedBuilder().setTitle("Lock")
                .setDescription(`Salon: ${message.channel}\nModérateur: ${message.author.tag}\nDate: ${new Date().toLocaleString()}`)
                .setColor("#ed4245")] }).catch(() => {});
        } catch (e) {
            console.error("lock error", e);
            message.reply("Erreur lors du lock du salon");
        }
        return;
    }

    if (command === "unlock") {
        if (!hasPermLevel(message, 9) && !isWhitelisted(message.guild.id, message.author.id)) {
            return message.reply("ta pas la perm pour cette cmd");
        }
        try {
            await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, {
                SendMessages: null,
                SendMessagesInThreads: null,
                AddReactions: null,
                CreatePublicThreads: null,
                CreatePrivateThreads: null
            });
            message.reply("Salon unlock");
            const logsChannel = await ensureLogs(message.guild, "lock");
            logsChannel.send({ embeds: [new EmbedBuilder().setTitle("Unlock")
                .setDescription(`Salon: ${message.channel}\nModérateur: ${message.author.tag}\nDate: ${new Date().toLocaleString()}`)
                .setColor("#57f287")] }).catch(() => {});
        } catch (e) {
            console.error("unlock error", e);
            message.reply("Erreur lors du unlock du salon");
        }
        return;
    }

    if (command === "allbots") {
        if (!isWhitelisted(message.guild.id, message.author.id)) {
            return message.reply("ta pas la perm pour cette cmd");
        }

        await message.guild.members.fetch().catch(() => null);
        const bots = message.guild.members.cache.filter(m => m.user.bot);

        if (bots.size === 0) return message.reply("Aucun bot sur ce serveur");

        const entries = [...bots.values()]
            .sort((a, b) => a.user.username.localeCompare(b.user.username))
            .map(m => `• **${m.user.tag}** (\`${m.id}\`)`);

        const chunks = [];
        let current = "";
        for (const line of entries) {
            if ((current + "\n" + line).length > 3900) {
                chunks.push(current);
                current = line;
            } else {
                current = current ? current + "\n" + line : line;
            }
        }
        if (current) chunks.push(current);

        for (let i = 0; i < chunks.length; i++) {
            const embed = new EmbedBuilder()
                .setTitle(`Bots du serveur (${bots.size})${chunks.length > 1 ? ` — page ${i + 1}/${chunks.length}` : ""}`)
                .setDescription(chunks[i])
                .setColor("#5865f2")
                .setTimestamp();
            await message.channel.send({ embeds: [embed] });
        }
        return;
    }

    if (command === "mutelist") {
        if (!hasPermLevel(message, 4) && !isWhitelisted(message.guild.id, message.author.id)) {
            return message.reply("ta pas la perm pour cette cmd");
        }

        await message.guild.members.fetch().catch(() => null);
        const now = Date.now();
        const muted = message.guild.members.cache.filter(m =>
            m.communicationDisabledUntilTimestamp && m.communicationDisabledUntilTimestamp > now
        );

        if (muted.size === 0) return message.reply("Aucun membre mute sur ce serveur");

        const entries = [...muted.values()]
            .sort((a, b) => a.communicationDisabledUntilTimestamp - b.communicationDisabledUntilTimestamp)
            .map(m => {
                const until = Math.floor(m.communicationDisabledUntilTimestamp / 1000);
                return `• **${m.user.tag}** (\`${m.id}\`) — fin <t:${until}:R> (<t:${until}:f>)`;
            });

        const chunks = [];
        let current = "";
        for (const line of entries) {
            if ((current + "\n" + line).length > 3900) {
                chunks.push(current);
                current = line;
            } else {
                current = current ? current + "\n" + line : line;
            }
        }
        if (current) chunks.push(current);

        for (let i = 0; i < chunks.length; i++) {
            const embed = new EmbedBuilder()
                .setTitle(`Membres mute (${muted.size})${chunks.length > 1 ? ` — page ${i + 1}/${chunks.length}` : ""}`)
                .setDescription(chunks[i])
                .setColor("#fee75c")
                .setTimestamp();
            await message.channel.send({ embeds: [embed] });
        }
        return;
    }

    if (command === "muteinfo") {
        if (!hasPermLevel(message, 2) && !isWhitelisted(message.guild.id, message.author.id)) {
            return message.reply("ta pas la perm pour cette cmd");
        }
        const target = await getMemberFromMentionOrId(message, args[0]);
        const targetId = target ? target.id : getTargetId(message, args[0]);
        if (!targetId) return message.reply("Mentionne un utilisateur ou donne son ID");

        const guildId = message.guild.id;
        sanctions[guildId] = sanctions[guildId] || {};
        const userSanctions = sanctions[guildId][targetId] || [];
        const lastMute = [...userSanctions].reverse().find(s => s.type === "mute");

        const member = target || await message.guild.members.fetch(targetId).catch(() => null);
        const tag = member ? member.user.tag : targetId;
        const avatar = member ? member.user.displayAvatarURL({ dynamic: true }) : null;

        const isCurrentlyMuted = member
            ? (member.communicationDisabledUntilTimestamp && member.communicationDisabledUntilTimestamp > Date.now()) ||
              member.roles.cache.some(r => r.name.toLowerCase() === "muted")
            : false;

        if (!lastMute && !isCurrentlyMuted) {
            return message.reply(`${tag} n'a jamais été mute`);
        }

        const embed = new EmbedBuilder()
            .setTitle("Mute info")
            .setColor("#9c84ef")
            .addFields(
                { name: "Utilisateur", value: `${tag} (\`${targetId}\`)`, inline: false },
                { name: "Raison", value: lastMute ? (lastMute.reason || "Aucune raison fournie") : "Aucune raison enregistrée", inline: false },
                { name: "Modérateur", value: lastMute ? (lastMute.mod || "Inconnu") : "Inconnu", inline: true },
                { name: "Date", value: lastMute ? (lastMute.date || "Inconnue") : "Inconnue", inline: true },
                { name: "Actuellement mute", value: isCurrentlyMuted ? "Oui" : "Non", inline: true }
            );
        if (avatar) embed.setThumbnail(avatar);
        return message.channel.send({ embeds: [embed] });
    }

    if (command === "rolemembers") {
        if (!hasPermLevel(message, 4) && !isWhitelisted(message.guild.id, message.author.id)) {
            return message.reply("ta pas la perm pour cette cmd");
        }
        const roleArg = args[0];
        if (!roleArg) return message.reply("Mentionne un rôle ou donne son ID");
        const roleId = roleArg.replace(/[<@&>]/g, "");
        const role = message.guild.roles.cache.get(roleId) || await message.guild.roles.fetch(roleId).catch(() => null);
        if (!role) return message.reply("Rôle introuvable");

        await message.guild.members.fetch().catch(() => null);
        const members = role.members;

        if (members.size === 0) {
            const emptyEmbed = new EmbedBuilder()
                .setTitle(`Membres du rôle ${role.name}`)
                .setDescription("Aucun membre n'a ce rôle")
                .setColor(role.color || "#5865f2");
            return message.channel.send({ embeds: [emptyEmbed] });
        }

        const entries = [...members.values()]
            .sort((a, b) => a.user.tag.localeCompare(b.user.tag))
            .map(m => `• **${m.user.tag}** (\`${m.id}\`)`);

        const chunks = [];
        let current = "";
        for (const line of entries) {
            if ((current + "\n" + line).length > 3900) {
                chunks.push(current);
                current = line;
            } else {
                current = current ? current + "\n" + line : line;
            }
        }
        if (current) chunks.push(current);

        for (let i = 0; i < chunks.length; i++) {
            const embed = new EmbedBuilder()
                .setTitle(`Membres du rôle ${role.name} (${members.size})${chunks.length > 1 ? ` — page ${i + 1}/${chunks.length}` : ""}`)
                .setDescription(chunks[i])
                .setColor(role.color || "#5865f2");
            await message.channel.send({ embeds: [embed] });
        }
        return;
    }

    // ================= WHITELIST COMMANDS =================
    if (command === "wl") {
        if (message.author.id !== BOT_OWNER_ID) {
            return message.reply("Seul le propriétaire du bot peut utiliser cette commande");
        }

        const userId = getIdFromMentionOrId(args[0]);
        if (!userId) return message.reply("Mentionne un utilisateur ou donne son ID");

        const user = await message.guild.members.fetch(userId).catch(() => null);
        if (!user) return message.reply("Utilisateur introuvable");

        const guildId = message.guild.id;
        whitelist[guildId] = whitelist[guildId] || [];
        if (!whitelist[guildId].includes(user.id)) {
            whitelist[guildId].push(user.id);
            saveWhitelist();
        }

        message.reply(`${user.user.tag} ajouté à la whitelist`);
    }

    if (command === "unwl") {
        if (message.author.id !== BOT_OWNER_ID) {
            return message.reply(" Seul le dev du bot peut use cette cmd");
        }

        const userId = getIdFromMentionOrId(args[0]);
        if (!userId) return message.reply("Tu dois mentionner un user ou donner son ID");

        const guildId = message.guild.id;
        whitelist[guildId] = whitelist[guildId] || [];
        if (!whitelist[guildId].includes(userId)) {
            return message.reply(` ${userId} n'est pas en wl`);
        }

        const user = await message.guild.members.fetch(userId).catch(() => null);
        whitelist[guildId] = whitelist[guildId].filter(id => id !== userId);
        saveWhitelist();
        message.reply(` ${(user ? user.user.tag : userId)} a été retiré de la wl`);
    }

    if (command === "wlsalon") {
        if (message.author.id !== BOT_OWNER_ID) {
            return message.reply("ta pas la perm pour cette cmd");
        }

        const userId = getIdFromMentionOrId(args[0]);
        if (!userId) return message.reply("Mentionne un utilisateur ou donne son ID");

        const user = await message.guild.members.fetch(userId).catch(() => null);
        const tag = user ? user.user.tag : userId;

        const added = addWlsalon(message.guild.id, userId);
        if (!added) return message.reply(`${tag} est déjà wlsalon`);

        message.reply(`${tag} est maintenant wlsalon, il peut créer et supprimer des salons`);

        const logsChannel = await ensureLogs(message.guild, "protection");
        logsChannel.send({ embeds: [new EmbedBuilder().setTitle("Wlsalon ajouté")
            .setDescription(`Utilisateur ${tag}\nModérateur ${message.author.tag}\nDate ${new Date().toLocaleString()}`)
            .setColor("#57f287")] }).catch(() => {});
    }

    if (command === "unwlsalon") {
        if (message.author.id !== BOT_OWNER_ID) {
            return message.reply("ta pas la perm pour cette cmd");
        }

        const userId = getIdFromMentionOrId(args[0]);
        if (!userId) return message.reply("Mentionne un utilisateur ou donne son ID");

        const removed = removeWlsalon(message.guild.id, userId);
        if (!removed) return message.reply(`<@${userId}> n'est pas wlsalon`);

        const user = await message.guild.members.fetch(userId).catch(() => null);
        const tag = user ? user.user.tag : userId;
        message.reply(`${tag} n'est plus wlsalon`);

        const logsChannel = await ensureLogs(message.guild, "protection");
        logsChannel.send({ embeds: [new EmbedBuilder().setTitle("Wlsalon retiré")
            .setDescription(`Utilisateur ${tag}\nModérateur ${message.author.tag}\nDate ${new Date().toLocaleString()}`)
            .setColor("#ed4245")] }).catch(() => {});
    }

    if (command === "own") {
        if (message.author.id !== BOT_OWNER_ID) {
            return message.reply("ta pas la perm pour cette cmd");
        }
        const userId = getIdFromMentionOrId(args[0]);
        if (!userId) return message.reply("Mentionne un utilisateur ou donne son ID");
        const user = await message.guild.members.fetch(userId).catch(() => null);
        const tag = user ? user.user.tag : userId;
        const added = addOwn(message.guild.id, userId);
        if (!added) return message.reply(`${tag} est déjà own`);
        message.reply(`${tag} est maintenant own, il peut bannir hors du bot sans être derank`);
        const logsChannel = await ensureLogs(message.guild, "protection");
        logsChannel.send({ embeds: [new EmbedBuilder().setTitle("Own ajouté")
            .setDescription(`Utilisateur ${tag}\nModérateur ${message.author.tag}\nDate ${new Date().toLocaleString()}`)
            .setColor("#57f287")] }).catch(() => {});
    }

    if (command === "regle") {
        if (message.author.id !== BOT_OWNER_ID) {
            return message.reply("ta pas la perm pour cette cmd");
        }

        const description = [
            "# 📜 Règlement du Serveur **Tsukiya** 🌸",
            "",
            "✨ Bienvenue sur le serveur ! Pour garantir une bonne ambiance pour tous, merci de **respecter ce règlement** Toute infraction peut entraîner des **sanctions**",
            "",
            "## 🤝 Respect et comportement",
            "• Le **respect entre membres** est obligatoire",
            "• ❌ Pas d'insultes, harcèlement, menaces ou discrimination",
            "• 💬 Pas de **spam**, majuscules abusives ou emojis excessifs",
            "• 🎤 En vocal : ne criez pas, ne coupez pas la parole et évitez les bruits gênants",
            "• ⚖️ Les conflits doivent être réglés **en privé (MP)** si nécessaire avec un modérateur",
            "",
            "## 🚫 Contenu interdit",
            "• ❌ Contenus **NSFW, gore, violents ou choquants** interdits",
            "• 😂 Les mèmes doivent rester dans les **salons appropriés**",
            "• 🔗 Pas de **spam publicitaire, phishing ou liens malveillants**",
            "• 🛠️ Aucun partage de **cheats, hacks, cracks ou piratage**",
            "",
            "## 👤 Identité",
            "• 🚫 Pseudos ou avatars **offensants, provocateurs ou trompeurs** interdits",
            "• ❌ Interdiction **d'usurper l'identité** d'un membre ou du staff",
            "",
            "## 💬 Salons",
            "• 📝 Respectez le **thème de chaque salon**",
            "• 🎧 En vocal : pas de spam sonore ou interruptions répétées",
            "• 🤖 Utilisez les **bots avec modération**",
            "",
            "## 🛡️ Modération",
            "Les sanctions peuvent inclure :",
            "• ⚠️ Avertissement",
            "• 🔇 Mute",
            "• 👢 Kick",
            "• 🔨 Ban temporaire ou définitif",
            "",
            "👮 Le **staff a le dernier mot** sur les décisions",
            "",
            "## 🔒 Sécurité",
            "• ❌ Ne partagez pas vos **informations personnelles**",
            "• 🚫 Le **doxxing** est strictement interdit et entraîne un **ban immédiat**",
            "",
            "## 📢 Informations",
            "• 📢 Les mises à jour du règlement seront annoncées dans <#1481231165879881931>",
            "",
            "✅ En restant sur le serveur, vous **acceptez toutes les règles**",
            "Respectez-les pour garder un **serveur agréable pour tous !**"
        ].join("\n");

        const embed = new EmbedBuilder()
            .setColor("#2b2d31")
            .setDescription(description);

        await message.channel.send({ embeds: [embed] });
        if (message.deletable) await message.delete().catch(() => {});
        return;
    }

    if (command === "unown") {
        if (message.author.id !== BOT_OWNER_ID) {
            return message.reply("ta pas la perm pour cette cmd");
        }
        const userId = getIdFromMentionOrId(args[0]);
        if (!userId) return message.reply("Mentionne un utilisateur ou donne son ID");
        const removed = removeOwn(message.guild.id, userId);
        if (!removed) return message.reply(`<@${userId}> n'est pas own`);
        const user = await message.guild.members.fetch(userId).catch(() => null);
        const tag = user ? user.user.tag : userId;
        message.reply(`${tag} n'est plus own`);
        const logsChannel = await ensureLogs(message.guild, "protection");
        logsChannel.send({ embeds: [new EmbedBuilder().setTitle("Own retiré")
            .setDescription(`Utilisateur ${tag}\nModérateur ${message.author.tag}\nDate ${new Date().toLocaleString()}`)
            .setColor("#ed4245")] }).catch(() => {});
    }

    if (command === "unban") {
        const userId = getTargetId(message, args[0]);
        if (!userId || !/^\d{17,19}$/.test(userId)) return message.reply("Donne un ID valide");

        const existing = await message.guild.bans.fetch(userId).catch(() => null);
        if (!existing) return message.reply(`Utilisateur ${userId} n'est pas banni`);

        try {
            await message.guild.bans.remove(userId);
        } catch (e) {
            return message.reply(`Impossible de débannir ${userId}`);
        }
        message.reply(`Utilisateur ${userId} a été unban`);
        const logsChannel = await ensureLogs(message.guild, "unban");
        logsChannel.send({ embeds: [new EmbedBuilder().setTitle("Unban")
            .setDescription(`Utilisateur ID: ${userId}\nModérateur: ${message.author.tag}\nDate: ${new Date().toLocaleString()}`)
            .setColor("#57f287")] });
        return;
    }

    if (command === "baninfo") {
        if (!hasPermLevel(message, 6) && !isWhitelisted(message.guild.id, message.author.id)) {
            return message.reply("ta pas la perm pour cette cmd");
        }

        const userId = getTargetId(message, args[0]);
        if (!userId) return message.reply("Mentionne un utilisateur ou donne son ID");

        const ban = await message.guild.bans.fetch(userId).catch(() => null);
        if (!ban) return message.reply("Cet utilisateur n'est pas banni ou l'ID est invalide");

        const reason = ban.reason && ban.reason.trim().length ? ban.reason : "Aucune raison fournie";
        const embed = new EmbedBuilder()
            .setTitle("Info ban")
            .setColor("#ed4245")
            .setThumbnail(ban.user.displayAvatarURL({ dynamic: true }))
            .addFields(
                { name: "Utilisateur", value: `${ban.user.tag} (\`${ban.user.id}\`)`, inline: false },
                { name: "Raison", value: reason.slice(0, 1024), inline: false }
            )
            .setTimestamp();

        return message.channel.send({ embeds: [embed] });
    }

    if (command === "banlist") {
        if (!hasPermLevel(message, 8) && !isWhitelisted(message.guild.id, message.author.id)) {
            return message.reply("ta pas la perm pour cette cmd");
        }

        const bans = await message.guild.bans.fetch().catch(() => null);
        if (!bans) return message.reply("Impossible de récupérer la liste des bans");
        if (bans.size === 0) return message.reply("Aucun membre banni sur ce serveur");

        const entries = [...bans.values()].map(b => {
            const tag = b.user?.tag || b.user?.username || b.user?.id || "Inconnu";
            const reason = b.reason && b.reason.trim().length ? b.reason : "Aucune raison";
            return `• **${tag}** (\`${b.user?.id}\`) — ${reason}`;
        });

        const chunks = [];
        let current = "";
        for (const line of entries) {
            if ((current + "\n" + line).length > 3900) {
                chunks.push(current);
                current = line;
            } else {
                current = current ? current + "\n" + line : line;
            }
        }
        if (current) chunks.push(current);

        for (let i = 0; i < chunks.length; i++) {
            const embed = new EmbedBuilder()
                .setTitle(`Bans de ${message.guild.name} (${bans.size})${chunks.length > 1 ? ` — page ${i + 1}/${chunks.length}` : ""}`)
                .setDescription(chunks[i])
                .setColor("#ed4245")
                .setTimestamp();
            await message.channel.send({ embeds: [embed] });
        }
        return;
    }

    // ================= MODERATION =================
    const modCommands = ["warn", "ban", "tempmute", "unmute", "bl"];
    if (modCommands.includes(command)) {
        const guildId = message.guild.id;
        whitelist[guildId] = whitelist[guildId] || [];
        sanctions[guildId] = sanctions[guildId] || {};
        const user = await getMemberFromMentionOrId(message, args[0]);
        if (!user) return message.reply("Tu dois mentionner un utilisateur ou donner son ID");
        const reason = args.slice(1).join(" ") || "Aucune raison fournie";

        const logsChannel = await ensureLogs(message.guild, command);

        if (command === "warn") {
            sanctions[guildId][user.id] = sanctions[guildId][user.id] || [];
            sanctions[guildId][user.id].push({ type: "warn", reason, date: new Date().toLocaleString(), mod: message.author.tag });
            saveSanctions();
            message.reply(` ${user.user.tag} a été warn`);
            logsChannel.send({ embeds: [new EmbedBuilder().setTitle("Warn")
                .setDescription(`Utilisateur: ${user.user.tag}\nModérateur: ${message.author.tag}\nRaison: ${reason}\nDate: ${new Date().toLocaleString()}`)
                .setColor("#fe7f32")] });
        }
        if (command === "ban") {
            await user.ban({ reason });
            message.reply(`${user.user.tag} a été banni`);
            logsChannel.send({ embeds: [new EmbedBuilder().setTitle("Ban")
                .setDescription(`Utilisateur: ${user.user.tag}\nModérateur: ${message.author.tag}\nRaison: ${reason}\nDate: ${new Date().toLocaleString()}`)
                .setColor("#ed4245")] });
        }
        if (command === "tempmute") {
            const muteRole = await ensureMuteRole(message.guild);
            await user.roles.add(muteRole);
            sanctions[guildId][user.id] = sanctions[guildId][user.id] || [];
            sanctions[guildId][user.id].push({ type: "mute", reason, date: new Date().toLocaleString(), mod: message.author.tag });
            saveSanctions();
            message.reply(`${user.user.tag} a été mute`);
            logsChannel.send({ embeds: [new EmbedBuilder().setTitle("Mute")
                .setDescription(`Utilisateur: ${user.user.tag}\nModérateur: ${message.author.tag}\nRaison: ${reason}\nDate: ${new Date().toLocaleString()}`)
                .setColor("#9c84ef")] });
        }
        if (command === "unmute") {
            const muteRole = await ensureMuteRole(message.guild);
            await user.roles.remove(muteRole);
            message.reply(` ${user.user.tag} a été unmute`);
            logsChannel.send({ embeds: [new EmbedBuilder().setTitle("Unmute")
                .setDescription(`Utilisateur: ${user.user.tag}\nModérateur: ${message.author.tag}\nDate: ${new Date().toLocaleString()}`)
                .setColor("#57f287")] });
        }
        if (command === "bl") {
            sanctions[guildId][user.id] = sanctions[guildId][user.id] || [];
            sanctions[guildId][user.id].push({ type: "bl", reason, date: new Date().toLocaleString(), mod: message.author.tag });
            saveSanctions();
            await user.ban({ reason });
            message.reply(` ${user.user.tag} est bl`);
            logsChannel.send({ embeds: [new EmbedBuilder().setTitle("bl")
                .setDescription(`Utilisateur: ${user.user.tag}\nModérateur: ${message.author.tag}\nRaison: ${reason}\nDate: ${new Date().toLocaleString()}`)
                .setColor(0x000000)] });
        }
    }

    if (command === "unbl") {
        const guildId = message.guild.id;
        sanctions[guildId] = sanctions[guildId] || {};

        const unblId = getTargetId(message, args[0]);
        if (!unblId) return message.reply("Tu dois donner l'ID ");
        if (!/^\d{17,19}$/.test(unblId)) return message.reply("ID invalide");

        if (sanctions[guildId][unblId]) {
            sanctions[guildId][unblId] = sanctions[guildId][unblId].filter(s => s.type !== "bl");
            saveSanctions();
        }

        const existing = await message.guild.bans.fetch(unblId).catch(() => null);
        if (existing) {
            await message.guild.bans.remove(unblId).catch(() => {});
        }
        message.reply(` ${unblId} est unbl`);
        const logsChannel = await ensureLogs(message.guild, "unbl");
        logsChannel.send({ embeds: [new EmbedBuilder().setTitle("unbl")
            .setDescription(`Utilisateur ID: ${unblId}\nModérateur: ${message.author.tag}\nDate: ${new Date().toLocaleString()}`)
            .setColor("#57f287")] });
        return;
    }

    if (command === "sanctions") {
        const guildId = message.guild.id;
        const target = await getMemberFromMentionOrId(message, args[0]);
        if (!target) return message.reply("Merci de mentionner un user ou donner son ID pour voir ses sanctions");

        const userSanctions = (sanctions[guildId] && sanctions[guildId][target.id]) ? sanctions[guildId][target.id] : [];
        if (!userSanctions.length) return message.reply(` ${target.user.tag} n'a aucune sanction `);

        const pageSize = 5;
        const totalPages = Math.ceil(userSanctions.length / pageSize);
        let currentPage = 0;

        const buildEmbed = (page) => {
            const slice = userSanctions.slice(page * pageSize, (page + 1) * pageSize);
            const embed = new EmbedBuilder()
                .setTitle("Sanctions")
                .setDescription(`Utilisateur: ${target.user.tag}\nPage ${page + 1}/${totalPages} - total ${userSanctions.length} sanctions`)
                .setColor("#992d22")
                .setFooter({ text: "+sanctions pour parcourir les sanctions" });

            slice.forEach((s, idx) => {
                const formatted = `**${s.type.toUpperCase()}** • ${s.reason || "Aucune raison"}\n_${s.date || "Date inconnue"} • ${s.mod || "Mod inconnue"}_`;
                embed.addFields({ name: `#${page * pageSize + idx + 1}`, value: formatted, inline: false });
            });

            return embed;
        };

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("sanctions-prev").setLabel("⬅️ 5 suivantes").setStyle(ButtonStyle.Secondary).setDisabled(currentPage === 0),
            new ButtonBuilder().setCustomId("sanctions-next").setLabel("➡️ 5 suivantes").setStyle(ButtonStyle.Secondary).setDisabled(currentPage === totalPages - 1),
            new ButtonBuilder().setCustomId("sanctions-clear").setLabel("🗑️ Supprimer toutes les sanctions").setStyle(ButtonStyle.Danger)
        );

        const replyMessage = await message.channel.send({ embeds: [buildEmbed(currentPage)], components: [row] });

        const collector = replyMessage.createMessageComponentCollector({ time: 120000 });

        collector.on("collect", async interaction => {
            if (interaction.user.id !== message.author.id) {
                return interaction.reply({ content: " Seulement l'auteur de la commande peut utiliser ce panneau", ephemeral: true });
            }

            if (interaction.customId === "sanctions-prev") {
                currentPage = Math.max(0, currentPage - 1);
            }
            if (interaction.customId === "sanctions-next") {
                currentPage = Math.min(totalPages - 1, currentPage + 1);
            }
            if (interaction.customId === "sanctions-clear") {
                sanctions[guildId][target.id] = [];
                saveSanctions();
                await interaction.update({
                    embeds: [new EmbedBuilder().setTitle("Sanctions").setDescription(`Utilisateur: ${target.user.tag}\nToutes les sanctions ont été supprimées`).setColor("#57f287")],
                    components: []
                });
                collector.stop();
                return;
            }

            const nextRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId("sanctions-prev").setLabel("⬅️ Précédent").setStyle(ButtonStyle.Secondary).setDisabled(currentPage === 0),
                new ButtonBuilder().setCustomId("sanctions-next").setLabel("➡️ Suivant").setStyle(ButtonStyle.Secondary).setDisabled(currentPage === totalPages - 1),
                new ButtonBuilder().setCustomId("sanctions-clear").setLabel("🗑️ Supprimer toutes les sanctions").setStyle(ButtonStyle.Danger)
            );

            await interaction.update({ embeds: [buildEmbed(currentPage)], components: [nextRow] });
        });

        collector.on("end", (_collected, reason) => {
            if (reason === "time") {
                replyMessage.edit({ components: [] }).catch(() => {});
            }
        });
    }

    // ================= CLEAR =================
    if (command === "clear") {
        if (!args[0] || isNaN(args[0])) return message.reply("Donne un nombre de messages à supprimer");
        let amount = parseInt(args[0]);
        if (amount < 1 || amount > 500) return message.reply("Le nombre doit être entre 1 et 500");
        await message.channel.bulkDelete(amount, true);
        message.reply(`${amount} messages supprimés`);
    }

    // ================= KICK =================
    if (command === "kick") {
        const user = await getMemberFromMentionOrId(message, args[0]);
        if (!user) return message.reply("Mentionne un utilisateur ou donne son ID à kick ");
        if (user.id === message.author.id) return message.reply("Tu ne peux pas te kick toi-même ");
        if (user.roles.highest.position >= message.member.roles.highest.position) return message.reply("Tu ne peux pas kick quelqu'un avec un role supérieur ou égal au tien ");
        const reason = args.slice(1).join(" ") || "Aucune raison";
        const logsChannel = await ensureLogs(message.guild, "kick");
        await user.kick(reason);
        message.reply(`${user.user.tag} a été kické Raison: ${reason}`);
        logsChannel.send({ embeds: [new EmbedBuilder().setTitle("Kick")
            .setDescription(`Utilisateur: ${user.user.tag}\nModérateur: ${message.author.tag}\nRaison: ${reason}\nDate: ${new Date().toLocaleString()}`)
            .setColor("#fe7f32")] });
    }

    // ================= ADDROLE =================
    if (command === "addrole") {
        const user = await getMemberFromMentionOrId(message, args[0]);
        if (!user) return message.reply("Mentionne un utilisateur ou donne son ID ");

        const embed = new EmbedBuilder()
            .setTitle("Ajout de rôle")
            .setDescription(`Cible : <@${user.id}>
Vous pouvez sélectionner un rôle à ajouter à cet utilisateur`)
            .setColor("#5865f2");

        const menu = new RoleSelectMenuBuilder()
            .setCustomId(`addrole_${user.id}_${message.author.id}`)
            .setPlaceholder("Choisir un rôle à ajouter")
            .setMaxValues(1); // Permet de sélectionner un seul rôle à la fois

        const row = new ActionRowBuilder().addComponents(menu);

        await message.channel.send({ embeds: [embed], components: [row] });
    }

    // ================= DELROLE =================
    if (command === "delrole") {
        try {
            const user = await getMemberFromMentionOrId(message, args[0]);
            if (!user) {
                return message.reply("Mentionne un utilisateur ou donne son ID ");
            }

            const removableRoles = user.roles.cache
                .filter(role =>
                    role.id !== message.guild.id &&
                    !role.managed &&
                    role.position < message.member.roles.highest.position
                )
                .sort((a, b) => b.position - a.position);

            if (removableRoles.size === 0) {
                return message.reply("Aucun rôle disponible à retirer");
            }

            const options = [...removableRoles.values()].slice(0, 25).map(role => ({
                label: role.name.slice(0, 100),
                value: role.id
            }));

            const embed = new EmbedBuilder()
                .setTitle("Retrait de rôle")
                .setDescription(`Cible : <@${user.id}>\nSélectionne un rôle à retirer (seuls ses rôles actuels sont listés)`)
                .setColor("#ed4245");

            const menu = new StringSelectMenuBuilder()
                .setCustomId(`delrole_${user.id}_${message.author.id}`)
                .setPlaceholder("Choisir un rôle à retirer")
                .setMinValues(1)
                .setMaxValues(1)
                .addOptions(options);

            const row = new ActionRowBuilder().addComponents(menu);

            await message.channel.send({ embeds: [embed], components: [row] });
        } catch (error) {
            console.error("Erreur dans la commande delrole:", error);
            message.reply("Une erreur est survenue lors de l'exécution de la commande");
        }
    }

    // ================= DERANK =================
    if (command === "derank") {
        if (!message.guild.members.me.permissions.has(PermissionsBitField.Flags.ManageRoles)) return message.reply("tu ne peut pas gerer les roles");
        const user = await getMemberFromMentionOrId(message, args[0]);
        if (!user) return message.reply("Mentionne un utilisateur ou donne son ID ");
        if (user.id === message.author.id) return message.reply("Tu ne peux pas te derank toi-même ");
        if (user.roles.highest.position >= message.member.roles.highest.position) return message.reply("Tu ne peux pas derank quelqu'un avec un Role supérieur ou égal au tien ");

        if (user.id === message.guild.ownerId) return message.reply("Impossible de derank le propriétaire du serveur");

        const rolesToRemove = user.roles.cache.filter(role => role.id !== message.guild.id && !role.managed);
        if (rolesToRemove.size === 0) return message.reply("aucun role a retirer");

        const botHighestRole = message.guild.members.me.roles.highest;
        const manageableRoles = rolesToRemove.filter(role => role.position < botHighestRole.position);
        if (manageableRoles.size === 0) return message.reply("derank impossible, le bot na pas les permissions suffisantes");

        try {
            await user.roles.remove(manageableRoles, `Derank par ${message.author.tag}`);
        } catch (e) {
            return message.reply("derank impossible, le bot na pas les permissions suffisantes");
        }
        message.reply(`${user.user.tag} est derank: ${manageableRoles.map(r => r.name).join(", ")})`);

        const logsChannel = await ensureLogs(message.guild, "derank");
        logsChannel.send({ embeds: [new EmbedBuilder().setTitle("Derank")
            .setDescription(`Utilisateur: ${user.user.tag}\nModérateur: ${message.author.tag}\nRoles retirés: ${manageableRoles.map(r => r.name).join(", ")}\nDate: ${new Date().toLocaleString()}`)
            .setColor("#ed4245")] });
    }

    // ================= SERVERINFO =================
    if (command === "serverinfo") {
        const embed = new EmbedBuilder()
            .setTitle("Informations du serveur")
            .setThumbnail(message.guild.iconURL({ dynamic: true }))
            .addFields(
                { name: "Nom", value: message.guild.name, inline: true },
                { name: "ID", value: message.guild.id, inline: true },
                { name: "Propriétaire", value: `<@${message.guild.ownerId}>`, inline: true },
                { name: "Membres", value: message.guild.memberCount.toString(), inline: true },
                { name: "Roles", value: message.guild.roles.cache.size.toString(), inline: true },
                { name: "Salons", value: message.guild.channels.cache.size.toString(), inline: true },
                { name: "Créé le", value: message.guild.createdAt.toLocaleDateString(), inline: true },
                { name: "Niveau de vérification", value: message.guild.verificationLevel.toString(), inline: true },
                { name: "Boosts", value: message.guild.premiumSubscriptionCount?.toString() || "0", inline: true }
            )
            .setColor("#5865f2");
        message.channel.send({ embeds: [embed] });
    }

    if (command === "stats") {
        const guildId = message.guild.id;
        if (activeStats[guildId]) {
            return message.reply("Les salons de statistiques sont déjà actifs et se mettent à jour toutes les 20 secondes");
        }

        const category = await ensureStatsCategory(message.guild);
        const statsChannels = await ensureStatsChannels(message.guild, category);

        activeStats[guildId] = statsChannels;
        config[guildId].statsActive = true;
        saveConfig();
        statsIntervals[guildId] = setInterval(async () => {
            const guild = client.guilds.cache.get(guildId);
            if (!guild) {
                clearInterval(statsIntervals[guildId]);
                delete statsIntervals[guildId];
                delete activeStats[guildId];
                config[guildId].statsActive = false;
                saveConfig();
                return;
            }
            const category = await ensureStatsCategory(guild);
            const channels = await ensureStatsChannels(guild, category);
            activeStats[guildId] = channels;
        }, 5000);

        message.reply("stats créés  mis à jour toutes les 5 secondes");
    }

    // ================= TICKET PANEL =================
if (command === "ticket") {
    const prompt = await message.channel.send("Dans quel salon veux-tu envoyer le panel ticket  Mentionne le salon");

    const filter = (m) => m.author.id === message.author.id;
    const ticketCollector = message.channel.createMessageCollector({ filter, max: 1, time: 60000 });

    async function getOrCreateCategory(guild, name) {
        let category = guild.channels.cache.find(
            c => c.type === ChannelType.GuildCategory && c.name === name
        );

        if (!category) {
            category = await guild.channels.create({
                name: name,
                type: ChannelType.GuildCategory,
            });
        }

        return category;
    }

    ticketCollector.on("collect", async (reply) => {
        const targetChannel = reply.mentions.channels.first();

        await prompt.delete().catch(() => {});
        await reply.delete().catch(() => {});

        if (!targetChannel || targetChannel.type !== ChannelType.GuildText) {
            const err = await message.channel.send("Salon invalide");
            return setTimeout(() => err.delete().catch(() => {}), 5000);
        }

        const embed = new EmbedBuilder()
            .setColor("#2b2d31")
            .setTitle("🌸 → TICKETS Tsukiya")
            .setDescription("__**Choisis un type de ticket dans le menu ci-dessous**__\n\n📝 Sélection du ticket :\n- Ticket GS\n- Ticket GAP\n- Ticket Owner\n- Ticket Syndicat\n- Ticket Brigade\n- Ticket CM\n\nChaque ticket ouvre un espace privé pour échanger avec le staff")
            .addFields(
                { name: "🌸 Ticket GS", value: "➜ Questions en rapport avec l'actualité du serv\n➜ Demande de rank\n➜ Demande de mission staff", inline: false },
                { name: "🌸 Ticket GAP", value: "➜ Conflits\n➜ Abus permission\n➜ Avertissement / Ban", inline: false },
                { name: "🌸 Ticket Owner", value: "➜ Rank up haut staff\n➜ Perms\n➜ DM ALL\n➜ Missions", inline: false },
                { name: "🌸 Ticket Syndicat", value: "➜ Giveaways\n➜ Suggestions\n➜ Syndicat", inline: false },
                { name: "🌸 Ticket Brigade", value: "➜ Harcèlement\n➜ Leak\n➜ Menaces", inline: false },
                { name: "🌸 Ticket CM", value: "➜ Partenariat\n➜ Recrutement CM", inline: false }
            )
            .setFooter({ text: "Tsukiya Ticket System" });

        const row = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId("ticket-menu")
                .setPlaceholder("Choisir un type de ticket")
                .addOptions([
                    { label: "Ticket GS", value: "Ticket GS" },
                    { label: "Ticket GAP", value: "Ticket GAP" },
                    { label: "Ticket Owner", value: "Ticket Owner" },
                    { label: "Ticket Syndicat", value: "Ticket Syndicat" },
                    { label: "Ticket Brigade", value: "Ticket Brigade" },
                    { label: "Ticket CM", value: "Ticket CM" }
                ])
        );

        await targetChannel.send({
            embeds: [embed],
            components: [row]
        });

        const confirmation = await message.reply(`Panel ticket envoyé dans ${targetChannel}`);
        setTimeout(() => confirmation.delete().catch(() => {}), 5000);
    });

    ticketCollector.on("end", (collected) => {
        if (collected.size === 0) {
            prompt.delete().catch(() => {});
            message.channel.send("Temps écoulé, commande annulée")
                .then(m => setTimeout(() => m.delete().catch(() => {}), 5000));
        }
    });
}
    // ================= CLOSE TICKET =================
    if (command === "close") {
        const ALLOWED_CLOSE_CATEGORY_IDS = new Set([
            "1496146100464390204",
            "1496145830216728586",
            "1496145254003511326",
            "1496146034290856047",
            "1496145932398362685",
            "1496146008416190535"
        ]);

        if (!message.channel.parentId || !ALLOWED_CLOSE_CATEGORY_IDS.has(message.channel.parentId)) {
            return message.reply("Cette commande ne peut être utilisée que dans les salons des catégories ticket autorisées");
        }

        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
            return message.reply("Tu n'as pas la permission de fermer ce ticket");
        }

        await message.channel.send("Ticket fermé Le salon sera supprimé dans 1 seconde");
        setTimeout(() => {
            message.channel.delete().catch(() => {});
            if (tickets[message.channel.id]) {
                delete tickets[message.channel.id];
                saveTickets();
            }
        }, 1000);
        return;
    }

    if (command === "rename") {
        const ALLOWED_RENAME_CATEGORY_IDS = new Set([
            "1496146100464390204",
            "1496145830216728586",
            "1496145254003511326",
            "1496146034290856047",
            "1496145932398362685",
            "1496146008416190535"
        ]);

        if (!message.channel.parentId || !ALLOWED_RENAME_CATEGORY_IDS.has(message.channel.parentId)) {
            return message.reply("Cette commande ne peut être utilisée que dans les salons des catégories ticket");
        }

        const newName = args.join(" ");
        if (!newName) {
            return message.reply("tu dois fournir un nouveau nom exemple +rename support bug");
        }

        try {
            await message.channel.setName(newName);
            return message.reply(`salon renommé en ${newName}`);
        } catch (err) {
            console.error(err);
            return message.reply("impossible de renommer le salon");
        }
    }

    // ================= USERINFO / PIC / VOICEINFO =================
    if (["userinfo", "pic", "voiceinfo"].includes(command)) {
        let user = await getMemberFromMentionOrId(message, args[0]);
        if (!user && command === "pic") {
            user = message.member;
        }
        if (!user) return message.reply("Tu dois mentionner un utilisateur ou donner son ID ");

        if (command === "userinfo") {
            const embed = new EmbedBuilder()
                .setTitle(`${user.user.tag}`)
                .setThumbnail(user.user.displayAvatarURL({ dynamic: true }))
                .addFields(
                    { name: "ID", value: user.id },
                    { name: "Pseudo", value: user.user.username },
                    { name: "Discrim", value: `#${user.user.discriminator}` },
                    { name: "Bot ", value: user.user.bot ? "Oui" : "Non" },
                    { name: "Rejoint le serveur", value: user.joinedAt.toLocaleString() }
                )
                .setColor("#5865f2");
            message.channel.send({ embeds: [embed] });
        }
        if (command === "pic") {
            const embed = new EmbedBuilder()
                .setTitle(`Photo de ${user.user.tag}`)
                .setImage(user.user.displayAvatarURL({ dynamic: true, size: 1024 }))
                .setColor("#5865f2");
            message.channel.send({ embeds: [embed] });
        }
    }

    // ================= SNIPE =================
    if (command === "snipe") {
        const sniped = snipedMessages.get(message.channel.id);
        if (!sniped) {
            return message.reply("Aucun message supprimé récemment dans ce salon");
        }

        const embed = new EmbedBuilder()
            .setColor("#ffcc00")
            .setAuthor({ name: sniped.authorTag, iconURL: sniped.authorAvatar || undefined })
            .setTimestamp(new Date(sniped.deletedAt))
            .setFooter({ text: "Supprimé à" });

        if (sniped.content) {
            embed.setDescription(sniped.content.length > 4096 ? `${sniped.content.slice(0, 4093)}...` : sniped.content);
        }
        if (sniped.imageURL) {
            embed.setImage(sniped.imageURL);
        }

        const otherAttachments = (sniped.attachmentURLs || []).filter(u => u !== sniped.imageURL);
        if (otherAttachments.length) {
            embed.addFields({ name: "Pièces jointes", value: otherAttachments.join("\n").slice(0, 1024) });
        }

        return message.channel.send({ embeds: [embed] });
    }

    // ================= FIND =================
    if (command === "find") {
        const user = await getMemberFromMentionOrId(message, args[0]);
        if (!user) return message.reply("mentionne un user");

        const voiceChannel = user.voice.channel ? user.voice.channel.name : "Aucun";
        const micMuted = user.voice.selfMute ? "Oui" : "Non";
        const deafened = user.voice.selfDeaf ? "Oui" : "Non";
        const customStatus = user.presence?.activities.find(a => a.type === 4)?.state || "Aucun";

        const embed = new EmbedBuilder()
            .setTitle(`Infos de ${user.user.tag}`)
            .setThumbnail(user.user.displayAvatarURL({ dynamic: true }))
            .addFields(
                { name: "Salon vocal", value: voiceChannel, inline: true },
                { name: "Micro mute", value: micMuted, inline: true },
                { name: "Casque mute", value: deafened, inline: true },
                { name: "Status perso", value: customStatus, inline: true }
            )
            .setColor("#5865f2");
        message.channel.send({ embeds: [embed] });
    }

    // ================= GIVEAWAY =================
    if (command === "giveaway") {
        const filter = m => m.author.id === message.author.id;

        try {
            const askChannel = await message.channel.send("Dans quel salon veux-tu lancer le giveaway  Mentionne le salon ");
            const collected1 = await message.channel.awaitMessages({ filter, max: 1, time: 60000, errors: ["time"] });
            const answer1 = collected1.first();
            await askChannel.delete().catch(() => {});
            await answer1.delete().catch(() => {});

            const channel = answer1.mentions.channels.first();
            if (!channel || channel.type !== 0) {
                const err1 = await message.channel.send("Salon invalide Annulé");
                return setTimeout(() => err1.delete().catch(() => {}), 5000);
            }

            const askPrize = await message.channel.send("Que contient le giveaway  (ex: Nitro x2)");
            const collected2 = await message.channel.awaitMessages({ filter, max: 1, time: 60000, errors: ["time"] });
            const answer2 = collected2.first();
            await askPrize.delete().catch(() => {});
            await answer2.delete().catch(() => {});
            const prize = answer2.content;

            const askDuration = await message.channel.send("Durée du giveaway en secondes ");
            const collected3 = await message.channel.awaitMessages({ filter, max: 1, time: 60000, errors: ["time"] });
            const answer3 = collected3.first();
            await askDuration.delete().catch(() => {});
            await answer3.delete().catch(() => {});

            const duration = parseInt(answer3.content);
            if (!duration || duration <= 0) {
                const err2 = await message.channel.send("Durée invalide Annulé");
                return setTimeout(() => err2.delete().catch(() => {}), 5000);
            }

            const endTime = Date.now() + duration * 1000;
            const embed = new EmbedBuilder()
                .setTitle(`# Giveaway: ${prize}`)
                .setDescription(`> Cliquez sur le bouton 🎉 pour participer\n> **Nombre de gagnants** : 1\n\n> Fin du giveaway : <t:${Math.floor(endTime / 1000)}:R>`)
                .setColor("#9c84ef");

            const button = new ButtonBuilder()
                .setCustomId(`giveaway_${message.id}`)
                .setLabel("Participer 🎉")
                .setStyle(ButtonStyle.Primary);

            const row = new ActionRowBuilder().addComponents(button);
            const giveawayMessage = await channel.send({ embeds: [embed], components: [row] });

            activeGiveaways[giveawayMessage.id] = {
                prize,
                winnersCount: 1,
                participants: [],
                messageId: giveawayMessage.id,
                channelId: channel.id,
                endTime
            };

            const collector = giveawayMessage.createMessageComponentCollector({ componentType: ComponentType.Button, time: duration * 1000 });
            collector.on("collect", i => {
                if (i.customId !== `giveaway_${message.id}`) return;
                if (!activeGiveaways[giveawayMessage.id].participants.includes(i.user.id)) {
                    activeGiveaways[giveawayMessage.id].participants.push(i.user.id);
                    i.reply({ content: `Tu participes au giveaway ${prize}  🎉`, ephemeral: true });
                } else {
                    i.reply({ content: "Tu es déjà inscrit ", ephemeral: true });
                }
            });

            collector.on("end", async () => {
                const giveawayData = activeGiveaways[giveawayMessage.id];
                const participants = giveawayData.participants;
                if (participants.length === 0) {
                    giveawayMessage.edit({ content: "Giveaway terminé : aucun participant", components: [] });
                    delete activeGiveaways[giveawayMessage.id];
                    return;
                }

                const winners = [];
                while (winners.length < giveawayData.winnersCount && participants.length > 0) {
                    const randomIndex = Math.floor(Math.random() * participants.length);
                    winners.push(participants.splice(randomIndex, 1)[0]);
                }

                const winnerMentions = winners.map(id => `<@${id}>`).join(", ");
                giveawayMessage.edit({ content: `🎉 Giveaway terminé ! Gagnants : ${winnerMentions}`, components: [] });
                delete activeGiveaways[giveawayMessage.id];
            });

            const confirm = await message.channel.send(`Giveaway lancé dans ${channel} `);
            setTimeout(() => confirm.delete().catch(() => {}), 5000);
        } catch (err) {
            const timeoutMsg = await message.channel.send("Temps écoulé ou erreur, commande +giveaway annulée");
            setTimeout(() => timeoutMsg.delete().catch(() => {}), 5000);
        }
    }

    if (command === "reroll") {
        const giveawayMessageId = args[0];
        if (!giveawayMessageId) return message.reply("Donne l'ID du message du giveaway à relancer");

        const giveawayData = activeGiveaways[giveawayMessageId];
        if (!giveawayData) return message.reply("Giveaway introuvable ou déjà terminé");

        const participants = [...giveawayData.participants];
        if (participants.length === 0) return message.reply("Aucun participant pour ce giveaway");

        const winners = [];
        while (winners.length < giveawayData.winnersCount && participants.length > 0) {
            const randomIndex = Math.floor(Math.random() * participants.length);
            winners.push(participants.splice(randomIndex, 1)[0]);
        }

        const winnerMentions = winners.map(id => `<@${id}>`).join(", ");
        message.channel.send(`🎉 Nouveau tirage pour ${giveawayData.prize} : ${winnerMentions}`);
    }

    // ================= CONFIG WELCOME =================
    if (command === "welcome") {
        const channel = message.mentions.channels.first();
        if (!channel) return message.reply("Mentionne un salon valide");

        const guildId = message.guild.id;
        if (!config[guildId]) config[guildId] = {};

        config[guildId].welcome = channel.id;
        saveConfig();
        message.reply("Salon welcome configuré");
        return;
    }

    if (command === "autorole") {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
            return message.reply("Tu n'as pas la permission de configurer l'autorole");
        }
        const role = message.mentions.roles.first() || message.guild.roles.cache.get(getIdFromMentionOrId(args[0]));
        if (!role) return message.reply("Mentionne un rôle valide ou donne son ID");

        const guildId = message.guild.id;
        if (!config[guildId]) config[guildId] = {};
        config[guildId].autorole = role.id;
        saveConfig();
        message.reply(`Autorole configuré sur ${role.name}`);
        return;
    }
});

// ================= FONCTIONS UTILES =================
async function ensureLogs(guild, type) {
    let category = guild.channels.cache.find(c => c.name === "Logs" && c.type === 4);
    if (!category) {
        category = await guild.channels.create({ name: "Logs", type: 4, permissionOverwrites: [{ id: guild.roles.everyone, deny: [PermissionsBitField.Flags.ViewChannel] }] });
    }
    const logNames = {
        ban: "logs-ban", tempmute: "logs-mute", warn: "logs-warn", bl: "logs-bl",
        unban: "logs-unban", unmute: "logs-unmute", derank: "logs-derank", protection: "logs-protection", message: "logs-message"
    };
    const logName = logNames[type] || "logs-general";
    let logChannel = guild.channels.cache.find(c => c.name === logName && c.parentId === category.id);
    if (!logChannel) {
        logChannel = await guild.channels.create({ name: logName, type: 0, parent: category.id, permissionOverwrites: [{ id: guild.roles.everyone, deny: [PermissionsBitField.Flags.ViewChannel] }] });
    }
    return logChannel;
}

async function ensureMuteRole(guild) {
    let role = guild.roles.cache.find(r => r.name === "Muted");
    if (!role) {
        role = await guild.roles.create({ name: "Muted", permissions: [] });
        guild.channels.cache.forEach(c => {
            c.permissionOverwrites.edit(role, { SendMessages: false, AddReactions: false, Speak: false });
        });
    }
    return role;
}

const STATS_CATEGORY_NAME = "📊➔ Statistiques Tsukiya 🌸";

async function ensureStatsCategory(guild) {
    let category = guild.channels.cache.find(c => c.name === STATS_CATEGORY_NAME && c.type === 4);

    if (!category) {
        category = await guild.channels.create({
            name: STATS_CATEGORY_NAME,
            type: 4
        });
    }

    if (category.position !== 0) {
        await category.setPosition(0).catch(() => {});
    }

    return category;
}

// ✅ FONCTION CORRECTE
async function buildStatsNames(guild) {
    await guild.channels.fetch();

    const onlineCount = guild.presences.cache.filter(p => p.status && p.status !== "offline").size;

    const voiceCount = guild.channels.cache
        .filter(c => c.type === 2 && c.members.size > 0)
        .reduce((acc, c) => acc + c.members.size, 0);

    return {
        members: `🧜・Membres : ${guild.memberCount}`,
        boosts: `🔮・Boosts : ${guild.premiumSubscriptionCount || 0}`,
        online: `✅・En ligne : ${onlineCount}`,
        voice: `🎧・En vocal : ${voiceCount}`
    };
}

// ✅ FIX ICI (await ajouté)
async function ensureStatsChannels(guild, category) {
    const names = await buildStatsNames(guild);

    const existingMembers = guild.channels.cache.find(c => c.parentId === category.id && c.type === 2 && c.name.startsWith("🧜・Membres :"));
    const existingBoosts = guild.channels.cache.find(c => c.parentId === category.id && c.type === 2 && c.name.startsWith("🔮・Boosts :"));
    const existingOnline = guild.channels.cache.find(c => c.parentId === category.id && c.type === 2 && c.name.startsWith("✅・En ligne :"));
    const existingVoice = guild.channels.cache.find(c => c.parentId === category.id && c.type === 2 && c.name.startsWith("🎧・En vocal :"));
    const existingGG = guild.channels.cache.find(c => c.parentId === category.id && c.type === 2 && c.name === "🧸・gg./Tsukiya");

const defaultPermissions = [
    {
        id: guild.roles.everyone.id,
        deny: [
            PermissionsBitField.Flags.Connect,
            PermissionsBitField.Flags.Speak
        ],
        allow: [
            PermissionsBitField.Flags.ViewChannel
        ]
    }
]

    const membersChannel = existingMembers || await guild.channels.create({
        name: names.members,
        type: 2,
        parent: category.id,
        permissionOverwrites: defaultPermissions
    });

    const boostsChannel = existingBoosts || await guild.channels.create({
        name: names.boosts,
        type: 2,
        parent: category.id,
        permissionOverwrites: defaultPermissions
    });

    const onlineChannel = existingOnline || await guild.channels.create({
        name: names.online,
        type: 2,
        parent: category.id,
        permissionOverwrites: defaultPermissions
    });

    const voiceChannel = existingVoice || await guild.channels.create({
        name: names.voice,
        type: 2,
        parent: category.id,
        permissionOverwrites: defaultPermissions
    });

    const ggChannel = existingGG || await guild.channels.create({
        name: "🧸・gg./Tsukiya",
        type: 2,
        parent: category.id,
        permissionOverwrites: defaultPermissions
    });

    if (membersChannel.name !== names.members) {
        await membersChannel.edit({ name: names.members }).catch(() => {});
    }

    if (boostsChannel.name !== names.boosts) {
        await boostsChannel.edit({ name: names.boosts }).catch(() => {});
    }

    if (onlineChannel.name !== names.online) {
        await onlineChannel.edit({ name: names.online }).catch(() => {});
    }

    if (voiceChannel.name !== names.voice) {
        await voiceChannel.edit({ name: names.voice }).catch(() => {});
    }

    return {
        members: membersChannel.id,
        boosts: boostsChannel.id,
        online: onlineChannel.id,
        voice: voiceChannel.id,
        gg: ggChannel.id
    };
}

// (optionnel, inchangé)
async function isExecutorWhitelisted(guild, auditType) {
    try {
        const logs = await guild.fetchAuditLogs({ limit: 1, type: auditType });
        const entry = logs.entries.first();
        if (!entry) return null;
        return entry.executor;
    } catch {
        return null;
    }
}
async function handleUnauthorizedCreation(entity, auditType, description) {
    if (!entity.guild) return;
    const guild = entity.guild;
    const guildId = guild.id;
    whitelist[guildId] = whitelist[guildId] || [];

    const executor = await isExecutorWhitelisted(guild, auditType);
    if (!executor) return;
    if (executor.id === BOT_OWNER_ID || whitelist[guildId].includes(executor.id)) return;
    if (isOwn(guildId, executor.id)) return;

    const [removedRoles] = await Promise.all([
        executor.bot ? Promise.resolve([]) : derankExecutor(guild, executor, "Anti-raid : création non autorisée").catch(() => []),
        entity.delete ? entity.delete().catch(() => {}) : Promise.resolve()
    ]);

    const logsChannel = await ensureLogs(guild, "protection");
    const name = entity.name || entity.id;
    logsChannel.send({ embeds: [new EmbedBuilder()
        .setTitle("Anti-Raid : action bloquée")
        .setDescription(`${description}`)
        .addFields(
            { name: "Agent", value: `${executor.tag} (${executor.id})`, inline: false },
            { name: "Cible", value: `${name}`, inline: false },
            { name: "Rôles retirés", value: removedRoles && removedRoles.size ? removedRoles.map(r => r.name).join(", ") : "aucun", inline: false }
        )
        .setColor("#ff0000")
    ]}).catch(() => {});
}

function isExecutorAllowedForChannels(guild, userId) {
    if (!userId) return false;
    if (userId === BOT_OWNER_ID) return true;
    if (isWlsalon(guild.id, userId)) return true;
    return false;
}

async function derankExecutor(guild, executor, reason = "Wlsalon: action non autorisée") {
    const member = await guild.members.fetch(executor.id).catch(() => null);
    if (!member) return [];
    const me = guild.members.me;
    if (!me) return [];
    const rolesToRemove = member.roles.cache.filter(role =>
        role.id !== guild.id &&
        !role.managed &&
        role.position < me.roles.highest.position
    );
    if (rolesToRemove.size === 0) return [];
    await member.roles.set([], reason).catch(async () => {
        await member.roles.remove(rolesToRemove, reason).catch(() => {});
    });
    return rolesToRemove;
}

client.on("channelCreate", async (channel) => {
    if (!channel.guild) return;
    const guild = channel.guild;
    const executor = await isExecutorWhitelisted(guild, AuditLogEvent.ChannelCreate);
    if (!executor) return;
    if (executor.bot) return;
    if (isExecutorAllowedForChannels(guild, executor.id)) return;

    const [removedRoles] = await Promise.all([
        derankExecutor(guild, executor, "Wlsalon: création de salon non autorisée").catch(() => []),
        channel.delete("Wlsalon: création de salon non autorisée").catch(() => {})
    ]);

    const logsChannel = await ensureLogs(guild, "protection");
    logsChannel.send({ embeds: [new EmbedBuilder()
        .setTitle("Wlsalon: création bloquée")
        .setDescription(`Un salon a été créé sans autorisation`)
        .addFields(
            { name: "Agent", value: `${executor.tag} (${executor.id})`, inline: false },
            { name: "Cible", value: `${channel.name || channel.id}`, inline: false },
            { name: "Rôles retirés", value: removedRoles.size ? removedRoles.map(r => r.name).join(", ") : "aucun", inline: false }
        )
        .setColor("#ff0000")
    ]}).catch(() => {});
});

client.on("channelDelete", async (channel) => {
    if (!channel.guild) return;
    const guild = channel.guild;
    const executor = await isExecutorWhitelisted(guild, AuditLogEvent.ChannelDelete);
    if (!executor) return;
    if (executor.bot) return;
    if (isExecutorAllowedForChannels(guild, executor.id)) return;

    const overwrites = channel.permissionOverwrites?.cache
        ? [...channel.permissionOverwrites.cache.value