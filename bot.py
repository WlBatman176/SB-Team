import discord
from discord.ext import commands
import json
import os
import datetime

# --- Configuration ---
TOKEN = os.getenv("DISCORD_BOT_TOKEN")
PREFIX = "<"
BACKUP_DIR = "backups"

# --- Bot Setup ---
intents = discord.Intents.all()
bot = commands.Bot(command_prefix=PREFIX, intents=intents)

os.makedirs(BACKUP_DIR, exist_ok=True)


def get_backup_path(user_id: int) -> str:
    """Get the backup file path for a specific user."""
    return os.path.join(BACKUP_DIR, f"backup_{user_id}.json")


@bot.event
async def on_ready():
    print(f"Bot connecté en tant que {bot.user} (ID: {bot.user.id})")
    print(f"Préfixe: {PREFIX}")
    print("---")


@bot.command(name="backup")
@commands.has_permissions(administrator=True)
async def backup_cmd(ctx, action: str = None):
    """
    Commandes de backup:
      <backup          → Sauvegarder le serveur actuel
      <backup salon    → Restaurer les salons depuis la backup
      <backup role     → Restaurer les rôles depuis la backup
      <backup all      → Restaurer tout (rôles + salons)
      <backup info     → Voir les infos de la backup sauvegardée
    """
    if action is None:
        await do_backup(ctx)
    elif action.lower() == "salon":
        await restore_channels(ctx)
    elif action.lower() == "role":
        await restore_roles(ctx)
    elif action.lower() == "all":
        await restore_all(ctx)
    elif action.lower() == "info":
        await backup_info(ctx)
    else:
        embed = discord.Embed(
            title="❌ Action inconnue",
            description=(
                "Commandes disponibles:\n"
                "`<backup` → Sauvegarder le serveur\n"
                "`<backup salon` → Restaurer les salons\n"
                "`<backup role` → Restaurer les rôles\n"
                "`<backup all` → Restaurer tout\n"
                "`<backup info` → Infos de la backup"
            ),
            color=discord.Color.red(),
        )
        await ctx.send(embed=embed)


async def do_backup(ctx):
    """Save the entire server structure to a JSON file."""
    guild = ctx.guild
    embed = discord.Embed(
        title="💾 Backup en cours...",
        description=f"Sauvegarde du serveur **{guild.name}**",
        color=discord.Color.blue(),
    )
    msg = await ctx.send(embed=embed)

    backup_data = {
        "server_name": guild.name,
        "server_id": guild.id,
        "backup_date": datetime.datetime.utcnow().isoformat(),
        "backed_up_by": ctx.author.id,
        "roles": [],
        "categories": [],
        "channels": [],
    }

    # --- Save Roles ---
    for role in guild.roles:
        if role.is_default():
            continue
        if role.managed:
            continue
        backup_data["roles"].append(
            {
                "name": role.name,
                "color": role.color.value,
                "hoist": role.hoist,
                "mentionable": role.mentionable,
                "permissions": role.permissions.value,
                "position": role.position,
            }
        )

    # --- Save Categories ---
    for category in guild.categories:
        cat_data = {
            "name": category.name,
            "position": category.position,
            "overwrites": serialize_overwrites(category.overwrites, guild),
        }
        backup_data["categories"].append(cat_data)

    # --- Save Channels ---
    for channel in guild.channels:
        if isinstance(channel, discord.CategoryChannel):
            continue

        chan_data = {
            "name": channel.name,
            "type": str(channel.type),
            "position": channel.position,
            "category": channel.category.name if channel.category else None,
            "overwrites": serialize_overwrites(channel.overwrites, guild),
        }

        if isinstance(channel, discord.TextChannel):
            chan_data["topic"] = channel.topic
            chan_data["nsfw"] = channel.nsfw
            chan_data["slowmode_delay"] = channel.slowmode_delay

        if isinstance(channel, discord.VoiceChannel):
            chan_data["bitrate"] = channel.bitrate
            chan_data["user_limit"] = channel.user_limit

        backup_data["channels"].append(chan_data)

    # --- Sort roles by position for correct restoration order ---
    backup_data["roles"].sort(key=lambda r: r["position"])

    # --- Save to file ---
    backup_path = get_backup_path(ctx.author.id)
    with open(backup_path, "w", encoding="utf-8") as f:
        json.dump(backup_data, f, indent=2, ensure_ascii=False)

    embed = discord.Embed(
        title="✅ Backup terminée !",
        description=f"Serveur **{guild.name}** sauvegardé avec succès.",
        color=discord.Color.green(),
    )
    embed.add_field(name="Rôles sauvegardés", value=str(len(backup_data["roles"])), inline=True)
    embed.add_field(name="Catégories sauvegardées", value=str(len(backup_data["categories"])), inline=True)
    embed.add_field(name="Salons sauvegardés", value=str(len(backup_data["channels"])), inline=True)
    embed.set_footer(text=f"Backup par {ctx.author} • Utilisez <backup salon/role/all pour restaurer")
    await msg.edit(embed=embed)


def serialize_overwrites(overwrites, guild):
    """Serialize permission overwrites to a JSON-safe format."""
    result = []
    for target, overwrite in overwrites.items():
        allow, deny = overwrite.pair()
        entry = {
            "allow": allow.value,
            "deny": deny.value,
        }
        if isinstance(target, discord.Role):
            entry["type"] = "role"
            entry["name"] = target.name
        else:
            entry["type"] = "member"
            entry["id"] = target.id
        result.append(entry)
    return result


def deserialize_overwrites(overwrites_data, guild):
    """Convert saved overwrites back to discord.py PermissionOverwrite objects."""
    overwrites = {}
    for entry in overwrites_data:
        if entry["type"] == "role":
            if entry["name"] == "@everyone":
                target = guild.default_role
            else:
                target = discord.utils.get(guild.roles, name=entry["name"])
            if target is None:
                continue
        else:
            target = guild.get_member(entry["id"])
            if target is None:
                continue

        allow = discord.Permissions(entry["allow"])
        deny = discord.Permissions(entry["deny"])
        overwrites[target] = discord.PermissionOverwrite.from_pair(allow, deny)
    return overwrites


async def restore_channels(ctx):
    """Restore channels and categories from the backup."""
    backup_path = get_backup_path(ctx.author.id)
    if not os.path.exists(backup_path):
        embed = discord.Embed(
            title="❌ Aucune backup trouvée",
            description="Fais d'abord `<backup` sur un serveur pour sauvegarder sa structure.",
            color=discord.Color.red(),
        )
        await ctx.send(embed=embed)
        return

    with open(backup_path, "r", encoding="utf-8") as f:
        backup_data = json.load(f)

    guild = ctx.guild
    embed = discord.Embed(
        title="🔄 Restauration des salons en cours...",
        description=f"Restauration depuis la backup de **{backup_data['server_name']}**",
        color=discord.Color.blue(),
    )
    msg = await ctx.send(embed=embed)

    created_categories = {}
    cat_count = 0
    chan_count = 0

    # --- Recreate Categories ---
    for cat_data in sorted(backup_data["categories"], key=lambda c: c["position"]):
        existing = discord.utils.get(guild.categories, name=cat_data["name"])
        if existing:
            created_categories[cat_data["name"]] = existing
            continue
        try:
            overwrites = deserialize_overwrites(cat_data.get("overwrites", []), guild)
            new_cat = await guild.create_category(
                name=cat_data["name"],
                position=cat_data["position"],
                overwrites=overwrites,
            )
            created_categories[cat_data["name"]] = new_cat
            cat_count += 1
        except discord.Forbidden:
            pass
        except discord.HTTPException:
            pass

    # --- Recreate Channels ---
    for chan_data in sorted(backup_data["channels"], key=lambda c: c["position"]):
        existing_text = discord.utils.get(guild.text_channels, name=chan_data["name"])
        existing_voice = discord.utils.get(guild.voice_channels, name=chan_data["name"])
        if existing_text or existing_voice:
            continue

        category = created_categories.get(chan_data.get("category"))
        overwrites = deserialize_overwrites(chan_data.get("overwrites", []), guild)

        try:
            if chan_data["type"] == "text":
                await guild.create_text_channel(
                    name=chan_data["name"],
                    category=category,
                    topic=chan_data.get("topic"),
                    nsfw=chan_data.get("nsfw", False),
                    slowmode_delay=chan_data.get("slowmode_delay", 0),
                    overwrites=overwrites,
                )
                chan_count += 1
            elif chan_data["type"] == "voice":
                await guild.create_voice_channel(
                    name=chan_data["name"],
                    category=category,
                    bitrate=chan_data.get("bitrate", 64000),
                    user_limit=chan_data.get("user_limit", 0),
                    overwrites=overwrites,
                )
                chan_count += 1
        except discord.Forbidden:
            pass
        except discord.HTTPException:
            pass

    embed = discord.Embed(
        title="✅ Restauration des salons terminée !",
        color=discord.Color.green(),
    )
    embed.add_field(name="Catégories créées", value=str(cat_count), inline=True)
    embed.add_field(name="Salons créés", value=str(chan_count), inline=True)
    embed.set_footer(text=f"Restauré depuis la backup de {backup_data['server_name']}")
    await msg.edit(embed=embed)


async def restore_roles(ctx):
    """Restore roles from the backup."""
    backup_path = get_backup_path(ctx.author.id)
    if not os.path.exists(backup_path):
        embed = discord.Embed(
            title="❌ Aucune backup trouvée",
            description="Fais d'abord `<backup` sur un serveur pour sauvegarder sa structure.",
            color=discord.Color.red(),
        )
        await ctx.send(embed=embed)
        return

    with open(backup_path, "r", encoding="utf-8") as f:
        backup_data = json.load(f)

    guild = ctx.guild
    embed = discord.Embed(
        title="🔄 Restauration des rôles en cours...",
        description=f"Restauration depuis la backup de **{backup_data['server_name']}**",
        color=discord.Color.blue(),
    )
    msg = await ctx.send(embed=embed)

    role_count = 0
    for role_data in backup_data["roles"]:
        existing = discord.utils.get(guild.roles, name=role_data["name"])
        if existing:
            continue
        try:
            await guild.create_role(
                name=role_data["name"],
                color=discord.Color(role_data["color"]),
                hoist=role_data["hoist"],
                mentionable=role_data["mentionable"],
                permissions=discord.Permissions(role_data["permissions"]),
            )
            role_count += 1
        except discord.Forbidden:
            pass
        except discord.HTTPException:
            pass

    embed = discord.Embed(
        title="✅ Restauration des rôles terminée !",
        color=discord.Color.green(),
    )
    embed.add_field(name="Rôles créés", value=str(role_count), inline=True)
    embed.set_footer(text=f"Restauré depuis la backup de {backup_data['server_name']}")
    await msg.edit(embed=embed)


async def restore_all(ctx):
    """Restore everything: roles first, then channels."""
    backup_path = get_backup_path(ctx.author.id)
    if not os.path.exists(backup_path):
        embed = discord.Embed(
            title="❌ Aucune backup trouvée",
            description="Fais d'abord `<backup` sur un serveur pour sauvegarder sa structure.",
            color=discord.Color.red(),
        )
        await ctx.send(embed=embed)
        return

    embed = discord.Embed(
        title="🔄 Restauration complète en cours...",
        description="Restauration des rôles puis des salons...",
        color=discord.Color.blue(),
    )
    await ctx.send(embed=embed)

    await restore_roles(ctx)
    await restore_channels(ctx)

    embed = discord.Embed(
        title="✅ Restauration complète terminée !",
        description="Tous les rôles et salons ont été restaurés.",
        color=discord.Color.green(),
    )
    await ctx.send(embed=embed)


async def backup_info(ctx):
    """Show info about the saved backup."""
    backup_path = get_backup_path(ctx.author.id)
    if not os.path.exists(backup_path):
        embed = discord.Embed(
            title="❌ Aucune backup trouvée",
            description="Fais d'abord `<backup` sur un serveur pour sauvegarder sa structure.",
            color=discord.Color.red(),
        )
        await ctx.send(embed=embed)
        return

    with open(backup_path, "r", encoding="utf-8") as f:
        backup_data = json.load(f)

    embed = discord.Embed(
        title="📋 Informations de la backup",
        color=discord.Color.blue(),
    )
    embed.add_field(name="Serveur d'origine", value=backup_data["server_name"], inline=False)
    embed.add_field(name="Date de backup", value=backup_data["backup_date"], inline=False)
    embed.add_field(name="Rôles", value=str(len(backup_data["roles"])), inline=True)
    embed.add_field(name="Catégories", value=str(len(backup_data["categories"])), inline=True)
    embed.add_field(name="Salons", value=str(len(backup_data["channels"])), inline=True)

    channels_list = ", ".join([c["name"] for c in backup_data["channels"][:15]])
    if len(backup_data["channels"]) > 15:
        channels_list += f"... (+{len(backup_data['channels']) - 15} de plus)"
    if channels_list:
        embed.add_field(name="Salons sauvegardés", value=channels_list, inline=False)

    await ctx.send(embed=embed)


@backup_cmd.error
async def backup_error(ctx, error):
    if isinstance(error, commands.MissingPermissions):
        embed = discord.Embed(
            title="❌ Permission refusée",
            description="Tu dois être **administrateur** pour utiliser cette commande.",
            color=discord.Color.red(),
        )
        await ctx.send(embed=embed)
    else:
        embed = discord.Embed(
            title="❌ Erreur",
            description=f"Une erreur est survenue: {error}",
            color=discord.Color.red(),
        )
        await ctx.send(embed=embed)


if __name__ == "__main__":
    if not TOKEN:
        print("ERREUR: Le token du bot n'est pas défini !")
        print("Définissez la variable d'environnement DISCORD_BOT_TOKEN")
        print("Exemple: export DISCORD_BOT_TOKEN='votre_token_ici'")
        exit(1)
    bot.run(TOKEN)
