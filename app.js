const app = require('express')()
const getPort = require('get-port');
const fs = require('fs')
const puppeteer = require('puppeteer');
const Discord = require("discord.js")
const bot = new Discord.Client()
// const BOT_TOKEN ='NjI0Mzk0MjQ2NDA0OTY0MzYy.XYUE7g.QFSJ7aSylTk0tncdG3YyuPhK8jo'
// const channelName = 'argus-twitter';
const BOT_TOKEN = 'NjIyMDYzODQ4ODY1NzkyMDAw.XYUITA.StTvqBOYVtN_Kiu3ZrXctTxgTUk'
const channelName = 'general';
bot.login(BOT_TOKEN);

let previousTweets = JSON.parse(fs.readFileSync("./cache.json")).lastTweets
const url = `https://twitter.com/${process.argv[2]}/`

bot.on('ready', () => {
    console.log('bot has launched..');
    bot.user.setStatus('online');
    const channel = bot.channels.find((x) => x.name == channelName)
    startMonitoring(channel)
});

bot.on('disconnect', function (msg, code) {
    if (code == 0) return console.error(msg);
});

async function startMonitoring(channel) {
    let browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });

    openNewPageNavigateToURL(browser, url, channel)
}

async function openNewPageNavigateToURL(browser, url, channel) {
    return new Promise(async (resolve, reject) => {
        let page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080 });
        await page.setRequestInterception(true);

        page.on('request', (req) => {
            if (req.resourceType() === 'image' || req.resourceType() === 'stylesheet') {
                req.abort();
            }
            else {
                req.continue();
            }
        });
        try {
            await page.goto(url);
        }
        catch (e) {
            console.log(e)
        }

        let lastTweet = previousTweets.find((x) => x.url == url);

        if (!!lastTweet) {
            getNewTweet(page, url, channel, lastTweet.tweet_id, 0)
        } else {
            getNewTweet(page, url, channel, null, 0)
        }
    })
}

const getNewTweet = async (page, url, channel, lastTweetId, count) => {
    let timestamp = await page.evaluate(() => document.querySelector('.js-stream-item:not(.js-pinned) .time span').innerText)
    count++
    if (!!timestamp.match(/[[1-60{s},1]/g) && timestamp.match(/[[1-60{s},1]/g).length == timestamp.length) { // new tweet
        console.log('found new tweet', timestamp)
        let tweet = await page.evaluate(() => {
            const isMedia = document.querySelector(`#stream-item-tweet-${document.querySelector('.js-stream-item:not(.js-pinned)').attributes['data-item-id'].textContent} .AdaptiveMedia-container`);
            const filteredContent = document.querySelector('.js-stream-item:not(.js-pinned) .js-tweet-text-container p').innerHTML.replace(/<(\w+)[^>]*>.*<\/\1>/g, '');
            let media = []

            if (!!isMedia) {
                for (let child of Array.from(isMedia.children)) {
                    for (let children of Array.from(child.children)) {
                        for (let chold of Array.from(children.children)) {
                            if (!!chold.src) {
                                media.push(chold.src)
                            } else {
                                media.push(chold.attributes['data-image-url'].textContent)
                            }
                        }
                    }
                }
            }
            console.log(filteredContent)
            return {
                content: filteredContent,
                classes: Array.from(document.querySelector('.js-stream-item:not(.js-pinned) div').classList),
                id: document.querySelector('.js-stream-item:not(.js-pinned)').attributes['data-item-id'].textContent,
                media,
                author: {
                    name: document.querySelector('.ProfileHeaderCard-name').innerText,
                    avatar: document.querySelector('.ProfileAvatar-container').href,
                    followers: !!document.querySelector('.ProfileNav-item--followers a .ProfileNav-value') ? document.querySelector('.ProfileNav-item--followers a .ProfileNav-value').innerText : null,
                }
            }
        })

        if (tweet.id !== lastTweetId && tweet.classes.indexOf('tweet-has-context') == -1) { // if this tweet is not the same as the previous one

            lastTweetId = tweet.id
            saveToCacheFile(previousTweets, { url, tweet_id: lastTweetId }, url)
            console.log('sending tweet..')

            sendDiscordEmbed({ ...tweet, profileLink: url, link: generateTweetLink(tweet.author, tweet.id) }, channel)

            // repeat the process
            await RefreshPageAndWait(page).then(() => {
                getNewTweet(page, url, channel, lastTweetId, count)
            })
        } else { // same tweet
            await RefreshPageAndWait(page).then(() => {
                getNewTweet(page, url, channel, lastTweetId, count)
            })
        }
    } else {
        await RefreshPageAndWait(page).then(() => {
            getNewTweet(page, url, channel, lastTweetId, count)
        })
    }
}

const sendDiscordEmbed = (tweet, channel) => {
    let embed = new Discord.RichEmbed()
        .setColor('#0099ff')
        .setAuthor(`${tweet.author.name}${!!tweet.author.followers ? ' - ' + tweet.author.followers : ' - 0'} Followers`, tweet.author.avatar, tweet.profileLink)


    if (tweet.content.length > 0) {
        embed.setDescription(tweet.content)
            .addBlankField()
    }
    debugger;
    embed.setImage(tweet.media[0])
    embed
        // .setURL(tweet.link)
        .addField('----Tweet----', tweet.link)
        .addField('----Profile----', tweet.profileLink)
    channel.send(embed)
    tweet.media.map((x, i) => {
        if (i !== 0) {
            channel.send(new Discord.RichEmbed(x)
                .setColor('#0099ff')
                .setImage(x))
        }
    })
}


const generateTweetLink = (author, tweetId) => {
    return `https://twitter.com/${author.name}/status/${tweetId}`
}

const RefreshPageAndWait = page => {
    return new Promise(async (resolve, reject) => {
        await page.evaluate(() => location.reload());
        await page
            .waitForSelector('.js-stream-item:not(.js-pinned)')
            .then(() => resolve())
            .catch((e) => resolve(RefreshPageAndWait(page)))
    })
}

const saveToCacheFile = (previousTweets, tweet, url) => {
    if (previousTweets.length < 1) {
        previousTweets.push(tweet)
    } else {
        previousTweets = previousTweets.map(matweet => {
            if (matweet.url == url) {
                return tweet
            }
            return matweet
        })
    }

    fs.writeFileSync("./cache.json", JSON.stringify({ lastTweets: previousTweets }, null, 4));
}


(async () => {
    app.listen(await getPort(), () => console.log(`Production Server is up on 4000 url: ${url}`));
})();

module.exports = app;