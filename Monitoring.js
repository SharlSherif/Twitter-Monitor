const {
    Discord
} = require('./public/Modules/ExternalModules')

const commands = require('./public/Commands')

function Google(channel, messageContent) {
    let UserImageQuery = messageContent.replace(`${commands.google}`, "");

    if (UserImageQuery) {
        googleSearch.build({
            q: `${UserImageQuery}`,
            start: 5,
            searchType: "image",
            gl: "eng", //geolocation, 
            lr: "lang_en",
            num: 1 // Number of search results to return between 1 and 10 
        }, (error, response) => {
            if(error) channel.send(`${error}`)

            const bannedWord = UserImageQuery.includes("gay");

            if (response && response.items && !bannedWord) {

                const title = response.items[0].title, // page title
                    image = response.items[0].link, // image itself
                    snippet = response.items[0].snippet; // short description

                const google_image_embed = new Discord.RichEmbed()
                    // .setAuthor(title, image) // the author page name
                    .setImage(image) // the image
                    // .setFooter(snippet.substring(1, 200)) // image description
                    .setColor('#3F51B5') // left side color

                channel.send(google_image_embed)
                    .then((message) => {
                        message.react("⏪")
                        message.react("⏩")
                    }).catch((err) => {
                        console.log(err)
                    });
                // send the embed
            } else {
                channel.send("`BANNED WORD`"); // send the embed
            }
        });
    } else {
        channel.send("`EMPTY`"); // send the embed        
    }
}

module.exports = Google