const app = require('express')()
const async = require('async')
const puppeteer = require('puppeteer');
const Discord = require("discord.js")
const bot = new Discord.Client()
bot.login('NjIyMDYzODQ4ODY1NzkyMDAw.XXulOg.HwOXEbuFkVlAQLNFjmo6JuC4XpI');

const channelName = 'general';
// const urls = [
//   'https://twitter.com/testmonitoring4',
//   'https://twitter.com/Cybersole'
// ]
let url = ''
// print process.argv
url = process.argv[2]
console.log(url)
bot.on('ready', () => {
  console.log('bot has launched..');
  bot.user.setStatus('online');
  bot.user.setActivity('running');
  const channel = bot.channels.find('name', channelName)
  startMonitoring(channel)
});

bot.on('disconnect', function (msg, code) {
  if (code == 0) return console.error(msg);
});


async function startMonitoring(channel) {
  let browser = await puppeteer.launch({ headless: true });
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
    await page.goto(url);

    getNewTweet(page, url, channel, null, 0)
  })
}

const getNewTweet = async (page, url, channel, lastTweetId, count) => {
  let timestamp = await page.evaluate(() => document.querySelector('.stream-item-header small span').innerText)
  count++
  console.log(url, count)
  if (!!timestamp.match(/[[1-60{s},1]/g) && timestamp.match(/[[1-60{s},1]/g).length > 1) { // new tweet
    let tweet = await page.evaluate(() => ({
      content: document.querySelector('.stream-item .js-tweet-text-container').innerText,
      id: document.querySelector('.js-stream-item').id.replace('stream-item-tweet-', ''),
      author: {
        name: document.querySelector('.ProfileHeaderCard-name').innerText,
        avatar: document.querySelector('.ProfileAvatar-container').href,
        followers: !!document.querySelector('.ProfileNav-item--followers a .ProfileNav-value') ? document.querySelector('.ProfileNav-item--followers a .ProfileNav-value').innerText : null,
      }
    }))

    console.log(tweet.id, lastTweetId)
    if (tweet.id !== lastTweetId) { // if this tweet is not the same as the previous one

      lastTweetId = tweet.id
      tweet = DiscordEmbed({ ...tweet, profileLink: url, link: generateTweetLink(tweet.author, tweet.id) })

      channel.send(tweet)
      // repeat the process
      await RefreshPageAndWait(page).then(() => {
        count++
        console.log(count)
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

const DiscordEmbed = tweet =>
  new Discord.RichEmbed()
    .setColor('#0099ff')
    .setAuthor(`${tweet.author.name}${!!tweet.author.followers ? '- ' + tweet.author.followers : ' - 0'} Followers`, tweet.author.avatar, 'https://google.com')
    .addBlankField()
    .setDescription(tweet.content)
    .addField('Tweet Link', tweet.link, true)

const generateTweetLink = (author, tweetId) => {
  return `https://twitter.com/${author.name}/status/${tweetId}`
}

const RefreshPageAndWait = page => {
  return new Promise(async (resolve, reject) => {
    await page.evaluate(() => location.reload());
    await page
      .waitForSelector('.stream-item .js-tweet-text-container')
      .then(() => resolve());
  })
}
app.listen(4000, () => console.log(`server is up on 4000`));

module.exports = app;