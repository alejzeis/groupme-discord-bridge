// Imports -----------------------------------------------------------------------------------------------------------------
const Discord = require("discord.js");
const YAML = require("yamljs");
const request = require("request-promise");
const express = require("express");
const bodyParser = require("body-parser");
const uuidv1 = require("uuid/v1");

const os = require("os");
const fs = require("fs");
const path = require("path");
const process = require("process");

// Config and functions -----------------------------------------------------------------------------------------------------------------
const defaultConfig = {
    listenPort: 8088,
    callbackURL: "/callback",
    discord: {
        username: "my-bot",
        token: "",
        guild: "0",
        channel: "0"
    },
    groupme: {
        name: "",
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

discordClient.on("presenceUpdate", (oldMember, newMember) => {
    let author = oldMember.nickname == null ? oldMember.user.username : oldMember.nickname;

    if(oldMember.presence.game == null && newMember.presence.game != null) {
        if(newMember.presence.game.streaming) {
            sendGroupMeMessage(author + " is now streaming at " + newMember.presence.game.url, null, () => {});
        }
    }

    if(oldMember.presence.game != null && newMember.presence.game != null) {
        if(oldMember.presence.game.streaming && !newMember.presence.game.streaming) {
            sendGroupMeMessage(author + " has stopped streaming", null, () => {});
        } else if(!oldMember.presence.game.streaming && newMember.presence.game.streaming){
            sendGroupMeMessage(author + " is now streaming at " + newMember.presence.game.url, null, () => {});
        }
    }
});

discordClient.on("message", (message) => {
    if(message.author.username === config.discord.username) return;
    if(message.channel.id !== config.discord.channel) return;
    if((message.content == null || message.content == "") && message.attachments.size == 0) return;

    let author = message.member.nickname == null ? message.author.username : message.member.nickname;

    if(message.attachments.size > 0) {
        // First download the image
        let attachment = message.attachments.values().next().value;
        download(attachment.url, attachment.filename, (mimetype, downloadedLocation) => {
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
        });
    } else {
        sendGroupMeMessage(author + ": " + message.cleanContent, null, () => {});
    }
});

expressApp.post(config.callbackURL, (req, res) => {
    if(req.body.name == config.groupme.name) return;

    var text = req.body.text;
    var sender = req.body.name;
    var attachments = req.body.attachments;

	if (attachments.length > 0) {
		let image = false;
		switch (attachments[0].type) {
			case "image":
				image = true;
			case "video":
				let array = attachments[0].url.split(".");
				let filename = uuidv1() + "." + array[array.length - 2];
				download(attachments[0].url, uuidv1(), (mimetype, downloadedLocation) => {
					fs.stat(downloadedLocation, (err, stats) => {
						if (err) {
							console.error(err);
							return;
						}

						// Discord does not allow files greater than 8MB unless user has Nitro
						if (stats.size > (1024 * 1024 * 8)) {
							discordChannel.send("**" + sender + "** ***Sent " + (image ? "an image" : "a video") + ":*** " + attachments[0].url).then(() => fs.unlink(downloadedLocation));
						} else {
							discordChannel.send("**" + sender + "**: " + text).then(() => {
								discordChannel.send("**" + sender + "** ***Sent " + (image ? "an image" : "a video") + ":***", new Discord.Attachment(downloadedLocation, filename)).then(() => fs.unlink(downloadedLocation));
							});
						}
					});
				});
				break;
			default:
				console.log("Unknown attachment: " + attachments[0].type);
		}
    } else {
        discordChannel.send("**" + sender + "**: " + text);
    }
});

discordClient.login(config.discord.token);
expressApp.listen(config.listenPort, () => console.log('Express now listening for requests'));
