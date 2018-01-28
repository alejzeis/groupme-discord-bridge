// Imports -----------------------------------------------------------------------------------------------------------------
const Discord = require("discord.js");
const YAML = require("yamljs");
const request = require("request-promise");
const express = require("express");
const bodyParser = require("body-parser");

const os = require("os");
const fs = require("fs");
const path = require("path");
const process = require("process");

// Config and functions -----------------------------------------------------------------------------------------------------------------
const defaultConfig = {
    listenPort: 8088,
    discord: {
        username: "my-bot",
        token: "",
        guild: 0,
        channel: 0
    },
    groupme: {
        botId: "",
        accessToken: ""
    }
};
var config;
var tempDir = path.join(os.tmpdir(), "groupme-discord-bridge");

function download(url, filename, callback) {
    request.head(url, (err, res, body) => {
        let downloadedLocation = path.join(tempDir, filename)
        let contentType = res.headers['content-type'];

        request(url).pipe(fs.createWriteStream(downloadedLocation)).on('close', () => callback(contentType, downloadedLocation));
    });
}

function sendGroupMeMessage(message, attachments, callback) {
    let options = {
        method: 'POST',
        uri: 'https://api.groupme.com/v3/bots/post',
        body: {
            bot_id: config.groupme.botId,
            text: message
        },
        json: true
    };

    if(attachments != null) {
        options.body.attachments = attachments;
    }

    request(options).then((res) => {
        callback(res);
    }).catch((err) => {
        console.error(err);
    });
}

// Program Main ----------------------------------------------------------------------------------------------------------------------------


try {
    fs.mkdirSync(tempDir);
} catch(e) {
    // Already exists
}

try {
    config = YAML.load("bridgeBot.yml");
} catch(e) {
    console.error("Could not load bridgeBot.yml, perhaps it doesn't exist? Creating it...");
    fs.writeFileSync("bridgeBot.yml", YAML.stringify(defaultConfig, 4));
    console.error("Configuration file created. Please fill out the fields and then run the bot again.")
    process.exit(1);
}

const discordClient = new Discord.Client();
const expressApp = express();
expressApp.use(bodyParser.json());
var discordGuild;
var discordChannel;

discordClient.on("ready", () => {
    console.log("Discord Client Ready.");
    discordGuild = discordClient.guilds.get(config.discord.guild);
    discordChannel = discordGuild.channels.get(config.discord.channel);
});

discordClient.on("message", (message) => {
    if(message.author.username === config.discord.username) return;
    if(message.channel.id !== config.discord.channel) return;
    if((message.content == null || message.content == "") && message.attachments.size == 0) return;

    let author = message.member.nickname == null ? message.author.username : message.member.nickname;
    console.log(author + ": " + message.cleanContent);

    if(message.attachments.size > 0) {
        console.log("message with attachment");
        // First download the image
        let attachment = message.attachments.values().next().value;
        download(attachment.url, attachment.filename, (mimetype, downloadedLocation) => {
            console.log("downloaded");
            let options = {
                method: 'POST',
                url: "https://image.groupme.com/pictures",
                headers: {
                    "X-Access-Token": config.groupme.accessToken
                },
                formData: {
                    file: fs.createReadStream(downloadedLocation)
                }
            };
            let req = request(options).then((res) => {
                sendGroupMeMessage(author + " sent an image:", [ { type: "image", url: JSON.parse(res).payload.url } ], (response) => {
                    console.log(response);
                });
            }).catch((err) => {
                console.error(err);
            });
            console.log("done");
        });
    } else {
        sendGroupMeMessage(author + ": " + message.cleanContent, null, () => {});
    }
});

expressApp.post('/callback', (req, res) => {
    var text = req.body.text;
    var sender = req.body.name;

    discordChannel.send("**" + sender + "**: " + text);
});

discordClient.login(config.discord.token);
expressApp.listen(config.listenPort, () => console.log('Express now listening for requests'));
