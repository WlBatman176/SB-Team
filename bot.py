import discord
from discord.ext import commands
import os

intents = discord.Intents.default()
intents.message_content = True

bot = commands.Bot(command_prefix="-", intents=intents)


@bot.event
async def on_ready():
    print(f"{bot.user} est connecté !")


@bot.event
async def on_message(message):
    if message.author == bot.user:
        return

    if bot.user.mentioned_in(message) and not message.mention_everyone:
        await message.channel.send("**mon prefix est -**")

    await bot.process_commands(message)


@bot.command(name="staff")
@commands.has_permissions(administrator=True)
async def staff(ctx):
    guild = ctx.guild

    # Permissions privées : personne ne voit sauf les admins et le bot
    overwrites = {
        guild.default_role: discord.PermissionOverwrite(view_channel=False),
        guild.me: discord.PermissionOverwrite(view_channel=True),
        ctx.author: discord.PermissionOverwrite(view_channel=True),
    }

    # ── Catégorie Staff ──
    staff_category = await guild.create_category("Staff", overwrites=overwrites)

    staff_channels = [
        "📣・annonces-staff",
        "📗・règlement-staff",
        "📑・hiérachie",
        "🔮・comment-rank-up",
        "📋・missions-staff",
        "🟤・chat-réu",
        "📒・recap-reu",
    ]

    for name in staff_channels:
        await staff_category.create_text_channel(name)

    # ── Catégorie Owner ──
    owner_category = await guild.create_category("Owner", overwrites=overwrites)

    owner_channels = [
        "😈・derank-statut",
        "📣・annonces-owner",
        "💬・only-owner",
        "🔮・charte-owner",
    ]

    for name in owner_channels:
        await owner_category.create_text_channel(name)

    # Salon vocal Owner Metting
    await owner_category.create_voice_channel("Owner Metting")

    await ctx.send("Catégories et salons Staff / Owner créés avec succès !")


@staff.error
async def staff_error(ctx, error):
    if isinstance(error, commands.MissingPermissions):
        await ctx.send("Tu n'as pas la permission d'utiliser cette commande.")


TOKEN = os.getenv("DISCORD_BOT_TOKEN")
bot.run(TOKEN)
