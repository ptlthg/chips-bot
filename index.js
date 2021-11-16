require("dotenv").config();
const _ = require('lodash');
const models = require('./models');
const API = require('./libs/chipsapi')();
const Autoevents = require('./libs/autoevents')(API);
const HttpServer = require("actions-http");
const { makeBroadcast } = require('./utils');
const { discord, telegram } = require('./connectors');
// your desired application interface.
const actions = {
  async ping(params) {
    return "pong";
  },
  async echo(params) {
    return params;
  },
};

// start the bot

API.init()
  .then(async () => {
    const commands = require('./commands')({
      API,
      models
    });
    commands.help = {
      description :'Description of all commands',
      handler: (ctx) => ctx.sendForm(models.help(commands))
    }
    const connectors = [];
    connectors.push(...await Promise.all([
      discord(process.env.DISCORD_TOKEN, commands),
      telegram(process.env.TELEGRAM_TOKEN, commands)
    ]));
    const broadcastText = makeBroadcast(connectors, "broadcastText");
    const broadcastForm = makeBroadcast(connectors, "broadcastForm");

    // background tasks
    setInterval(() => {
      const { bigwins, luckiest } = Autoevents.poll();
      if(bigwins){
        const currency =  _.get(bigwins, "bet.currency")
        const gamecode =  _.get(bigwins, "bet.gamecode")
        const currencyInfo = API.get('public', 'currencies', currency);
        const slot = _.find(API.getSlots(), (s) => _.eq(_.get(s, "game_code"), gamecode));
        if(!slot) return;
        if(!slot.url_thumb) return;
        
        broadcastForm(models.autoevents.bigwin({
          ...bigwins.bet, 
          currencyInfo, 
          banner: slot.url_thumb, 
          url: `https://chips.gg/casino/${gamecode}`
        }));
      }else if(luckiest){
        const currency =  _.get(luckiest, "bet.currency")
        const gamecode =  _.get(luckiest, "bet.gamecode")
        const currencyInfo = API.get('public', 'currencies', currency);
        const slot = _.find(API.getSlots(), (s) => _.eq(_.get(s, "game_code"), gamecode));
        if(!slot) return;
        if(!slot.url_thumb) return;

        broadcastForm(models.autoevents.luckiest({
          ...luckiest.bet, 
          currencyInfo, 
          banner: slot.url_thumb, 
          url: `https://chips.gg/casino/${gamecode}` 
        }));
      }
    }, 1000 || 15*60*1000); // every 15 min

    await HttpServer(
      {
        port: process.env.PORT || 3000
      },
      actions
    );
    return {
      broadcastForm, 
      broadcastText
    }
  })
  .then(({ broadcastText }) => {
    console.log('The bot Chips is successfully loaded')
    setTimeout(() => broadcastText('**The bot Chips is successfully loaded. /help**'), 10 * 1000);
  })
  .catch(console.error);