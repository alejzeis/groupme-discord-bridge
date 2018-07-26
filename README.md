# groupme-discord-bridge
A bridge bot which connects a GroupMe chat and a Discord Channel. It's designed to be ran on a server so it is completely command-line only. You can run it on your home computer but it is not recommended, as you need to open your firewall up so GroupMe can send messages to the bridge.

**SECURITY NOTICE:** Theoretically someone COULD intercept messages from GroupMe to the bridge if you do not run behind a reverse proxy, which isn't covered here. That is because the bridge uses a plain HTTP server to recieve data from GroupMe. If you want messages to be secure, it is recommended to run the bridge behind a reverse proxy such as [nginx](https://www.nginx.com/), as your forward web server would have HTTPS enabled, and all requests would go to it, which it would then send over the local network to the bridge.

## Requirements
- NodeJS installed.
- Your firewall opened for a port so GroupMe can send the bridge messages **OR** a forward facing web server like Nginx or Apache that you can configure a reverse proxy for.

### Limitations
The program can only bridge a single GroupMe Group and a single Discord Channel together. Because of how GroupMe Bots work (only a single bot can be in a single group), this is unlikely to change soon.

## Setting up
First you can clone this repository (or download it) and then run ```npm install``` to fetch dependencies.

Now you can run ```node app.js```. It should error out saying you don't have a config file, and it will create a skeleton one for you, which should look something like this:
```yaml
listenPort: 8088
callbackURL: "/callback"
discord:
    username: my-bot
    token: ""
    guild: '0'
    channel: '0'
groupme:
    botId: ""
    accessToken: ""

```

You can change "listenPort" to the port you want the bridge to listen on. That's the port GroupMe will be sending messages to, and the one that needs to be open in your Firewall **OR** configured your reverse proxy to, which is out of scope of this guide. There are many guides online on how to configure a reverse proxy.

Next you will need to create a Discord bot account on the Discord developers page. You can use this [handy guide](https://github.com/reactiflux/discord-irc/wiki/Creating-a-discord-bot-&-getting-a-token). The Discord web interface has changed a bit, (you'll need to select "Bot" on the far left to create the bot account and see the access token). Once you've added the Discord bot to your Guild you'll need to copy the "Token" and put them in the ```bridgeBot.yml``` config file. It goes to the "token" field under the "discord"  in the YAML file. Also fill in the "username" field with the Discord bot's username that you gave.
```
listenPort: 8088
callbackURL: "/callback"
discord:
    username: "YOUR DISCORD BOT's USERNAME HERE"
    token: "YOUR DISCORD TOKEN HERE"
    guild: '0'
    channel: '0'
groupme:
    botId: ""
    accessToken: ""

```

Now you will need the Guild and Channel IDs for the Discord side. In Discord you'll need to enable Developer mode (you can find this option under "Settings->Appearance->Advanced". Now you can right click on the Discord Guild (or server as it is called in the client) and click "copy-ID". You can paste that in the "guild" field in ```bridgeBot.yml```. Do the same for the channel by right clicking on the channel and clicking "copy-ID". Paste that in the "channel" field.
```
listenPort: 8088
callbackURL: "/callback"
discord:
    username: "YOUR DISCORD BOT's USERNAME HERE"
    token: "YOUR DISCORD TOKEN HERE"
    guild: 'THE GUILD ID YOU COPIED'
    channel: 'THE CHANNEL ID YOU COPIED'
groupme:
    botId: ""
    accessToken: ""

```

Finally we need to set up the GroupMe bot. Head over to https://dev.groupme.com/ and sign in with your GroupMe account. Once you've logged in you'll need to head over to https://dev.groupme.com/bots and click on the "Create a Bot" button. Select which GroupMe group you want the bot to be in, and give it a Name and an Avatar URL (a URL to a picture) if you chose to do so. For the callback URL you need to put in the address that the bridge will recieve GroupMe messages from.

For example, if I am running the bridge on my server, myserver.com, and I set "listenPort" to be 8088 and "callbackURL" set to "/callback", then the callback URL will be "http://myserver.com:8088/callback".

The callback URL is very important, as if it is not correct then the bridge will not recieve messages from GroupMe and nothing will show up in Discord. This is probably the number 1 cause of the bridge not working.

Once you've created the GroupMe bot, copy it's "bot ID" and paste it in ```bridgeBot.yml``` in the "botId" field. You'll also need to copy your GroupMe access token, which can be found by clicking on "Access Token" in the top right of the GroupMe developers site.
```
listenPort: 8088
callbackURL: "/callback"
discord:
    username: "YOUR DISCORD BOT's USERNAME HERE"
    token: "YOUR DISCORD TOKEN HERE"
    guild: 'THE GUILD ID YOU COPIED'
    channel: 'THE CHANNEL ID YOU COPIED'
groupme:
    botId: "THE GROUPME BOT's ID"
    accessToken: "YOUR GROUPME ACCESS TOKEN"
```

Now you should be all set! Save the config file and give the bridge a run by running ```node app.js```.
