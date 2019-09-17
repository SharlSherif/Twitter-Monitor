const app = require('express')()
const async = require('async')
const fs = require('fs')
const puppeteer = require('puppeteer');
const Discord = require("discord.js")
const bot = new Discord.Client()
bot.login('NjIyMDYzODQ4ODY1NzkyMDAw.XXulOg.HwOXEbuFkVlAQLNFjmo6JuC4XpI');

const channelName = 'general';
const urls = [
  'https://twitter.com/testmonitoring4',
  'https://twitter.com/Cybersole',
  'https://twitter.com/MohamedAFarg1'
]
const previousTweets = JSON.parse(fs.readFileSync("./cache.json")).lastTweets
console.log(previousTweets)
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

// const previousTweets = JSON.parse(fs.readFileSync("./cache.json"));
// console.log(previousTweets)
// previousTweets.lastTweets.push({url: 'a7a', tweet_id: 'lol'})
// fs.writeFileSync("./cache.json", JSON.stringify(previousTweets, null, 4));
// console.log(JSON.parse(fs.readFileSync("./cache.json")));
async function startMonitoring(channel) {
  let browser = await puppeteer.launch({ headless: true });

  openNewPageNavigateToURL(browser, 'https://twitter.com/testmonitoring4', channel)
  // openNewPageNavigateToURL(browser, 'https://twitter.com/Cybersole', channel)
  // openNewPageNavigateToURL(browser,   'https://twitter.com/MohamedAFarg1', channel)
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

    const lastTweet = previousTweets.find(({ url }) => url == url);

    if (!!lastTweet) {
      getNewTweet(page, url, channel, lastTweet.tweet_id, 0)
    } else {
      getNewTweet(page, url, channel, null, 0)
    }
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

    // console.log(tweet.id, lastTweetId)
    if (tweet.id !== lastTweetId) { // if this tweet is not the same as the previous one

      lastTweetId = tweet.id
      previousTweets.push({ url, tweet_id: lastTweetId })      
      fs.writeFileSync("./cache.json", JSON.stringify({lastTweets: previousTweets}, null, 4));

      tweet = DiscordEmbed({ ...tweet, profileLink: url, link: generateTweetLink(tweet.author, tweet.id) })

      channel.send(tweet)
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

// function exitHandler() {
//   const previousTweets = JSON.parse(fs.readFileSync("./cache.json"));
//   previousTweets.lastTweets.push(data)
//   fs.writeFileSync("./cache.json", JSON.stringify(previousTweets, null, 4));
//   console.log(previousTweets)
//   // process.exit();
// }

process.stdin.resume();//so the program will not close instantly

function exitHandler(options, exitCode) {
  if (options.cleanup) console.log('clean');
  if (exitCode || exitCode === 0) console.log(exitCode);
  if (options.exit) process.exit();
}

//do something when app is closing
process.on('exit', exitHandler.bind(null, { cleanup: true }));

//catches ctrl+c event
process.on('SIGINT', exitHandler.bind(null, { exit: true }));

// catches "kill pid" (for example: nodemon restart)
process.on('SIGUSR1', exitHandler.bind(null, { exit: true }));
process.on('SIGUSR2', exitHandler.bind(null, { exit: true }));

//catches uncaught exceptions
process.on('uncaughtException', exitHandler.bind(null, { exit: true }));

app.listen(4000, () => console.log(`server is up on 4000`));

module.exports = app;