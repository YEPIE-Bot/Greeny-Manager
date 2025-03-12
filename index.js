const { Client, GatewayIntentBits, Collection, EmbedBuilder } = require('discord.js');
const fs = require('fs');
require('dotenv').config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
  ]
});

client.commands = new Collection();
client.slashCommands = new Collection();
client.prefix = '!'; // Default prefix

// Safe server and log channel IDs
const SAFE_SERVER = '1349034219657236522';
const LOG_CHANNEL = '1349204960708923532';

// Load prefix settings
const prefixes = JSON.parse(fs.readFileSync('./data/prefixes.json', 'utf8'));

// Command handler
const commandFolders = fs.readdirSync('./commands');
for (const folder of commandFolders) {
  const commandFiles = fs.readdirSync(`./commands/${folder}`).filter(file => file.endsWith('.js'));
  for (const file of commandFiles) {
    const command = require(`./commands/${folder}/${file}`);
    if (command.slash) {
      client.slashCommands.set(command.name, command);
    }
    client.commands.set(command.name, command);
  }
}

// Event handler
const eventFiles = fs.readdirSync('./events').filter(file => file.endsWith('.js'));
for (const file of eventFiles) {
  const event = require(`./events/${file}`);
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args, client));
  } else {
    client.on(event.name, (...args) => event.execute(...args, client));
  }
}

// When the bot starts, leave all servers except the safe one
client.once('ready', async () => {
  console.log(`${client.user.tag} is online!`);

  for (const [id, guild] of client.guilds.cache) {
    if (id !== SAFE_SERVER) {
      const leaveEmbed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle('🛑 Left Unauthorized Server')
        .addFields(
          { name: 'Server Name', value: guild.name, inline: true },
          { name: 'Server ID', value: guild.id, inline: true },
          { name: 'Member Count', value: `${guild.memberCount}`, inline: true }
        )
        .setTimestamp();

      await guild.leave();
      const logChannel = client.channels.cache.get(LOG_CHANNEL);
      if (logChannel) logChannel.send({ embeds: [leaveEmbed] });
    }
  }
});

// When the bot gets added to a new server, leave immediately and log
client.on('guildCreate', async (guild) => {
  if (guild.id !== SAFE_SERVER) {
    const leaveEmbed = new EmbedBuilder()
      .setColor('#FF0000')
      .setTitle('🛑 Left Unauthorized Server')
      .addFields(
        { name: 'Server Name', value: guild.name, inline: true },
        { name: 'Server ID', value: guild.id, inline: true },
        { name: 'Member Count', value: `${guild.memberCount}`, inline: true }
      )
      .setTimestamp();

    await guild.leave();
    const logChannel = client.channels.cache.get(LOG_CHANNEL);
    if (logChannel) logChannel.send({ embeds: [leaveEmbed] });
  }
});

// Prefix and mention command handler
client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.guild) return;

  const prefix = prefixes[message.guild.id] || client.prefix;
  const mention = `<@${client.user.id}>`;

  let args, commandName;

  if (message.content.startsWith(prefix)) {
    args = message.content.slice(prefix.length).trim().split(/ +/);
    commandName = args.shift().toLowerCase();
  } else if (message.content.startsWith(mention)) {
    args = message.content.slice(mention.length).trim().split(/ +/);
    commandName = args.shift()?.toLowerCase();
  } else {
    return;
  }

  const command = client.commands.get(commandName);
  if (!command) return;

  try {
    await command.execute(message, args, client);
  } catch (error) {
    console.error(error);
    const errorEmbed = new EmbedBuilder()
      .setColor('#FF0000') // Hex for red
      .setTitle('❌ Error')
      .setDescription('An error occurred while executing this command.')
      .setTimestamp();
    message.reply({ embeds: [errorEmbed] });
  }
});

// Slash command handler
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isCommand()) return;

  const command = client.slashCommands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction, client);
  } catch (error) {
    console.error(error);
    const errorEmbed = new EmbedBuilder()
      .setColor('#FF0000') // Hex for red
      .setTitle('❌ Error')
      .setDescription('An error occurred while executing this command.')
      .setTimestamp();
    await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
  }
});

// Login the bot
client.login(process.env.BOT_TOKEN);
      
