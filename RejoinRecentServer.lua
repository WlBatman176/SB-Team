--[[
    Rejoin Recent Server Script
    Permet de rejoindre le jeu sur un serveur récent (le plus nouveau disponible)
    
    Place ID: 89953384612326
    
    Utilisation: Exécutez ce script dans votre exécuteur Roblox
    Le script va automatiquement chercher un serveur récent et vous y téléporter
]]

-- ===== CONFIGURATION =====
local PLACE_ID = 89953384612326 -- ID du jeu à rejoindre
local SERVER_LIMIT = 100         -- Nombre max de serveurs à analyser par page
-- =========================

-- Services
local HttpService = game:GetService("HttpService")
local TeleportService = game:GetService("TeleportService")
local Players = game:GetService("Players")
local LocalPlayer = Players.LocalPlayer

-- Récupérer la liste des serveurs publics
local function fetchServers(cursor)
    local url = string.format(
        "https://games.roblox.com/v1/games/%d/servers/Public?sortOrder=Asc&limit=%d%s",
        PLACE_ID,
        SERVER_LIMIT,
        cursor and ("&cursor=" .. cursor) or ""
    )

    local success, response = pcall(function()
        return game:HttpGet(url)
    end)

    if not success then
        warn("[RejoinRecent] Erreur HTTP: " .. tostring(response))
        return nil
    end

    local ok, data = pcall(function()
        return HttpService:JSONDecode(response)
    end)

    if not ok then
        warn("[RejoinRecent] Erreur JSON: " .. tostring(data))
        return nil
    end

    return data
end

-- Trouver le serveur le plus récent (dernier dans la pagination)
local function findRecentServer()
    print("[RejoinRecent] Recherche du serveur le plus récent...")

    local currentJobId = game.JobId
    local lastPageServers = nil
    local cursor = nil
    local pageCount = 0

    -- Parcourir toutes les pages pour atteindre les serveurs les plus récents
    repeat
        local data = fetchServers(cursor)

        if not data or not data.data then
            break
        end

        pageCount = pageCount + 1
        print(string.format("[RejoinRecent] Page %d - %d serveurs trouvés", pageCount, #data.data))

        if #data.data > 0 then
            lastPageServers = data.data
        end

        cursor = data.nextPageCursor
    until not cursor

    if not lastPageServers or #lastPageServers == 0 then
        warn("[RejoinRecent] Aucun serveur trouvé pour ce jeu.")
        return nil
    end

    -- Les serveurs les plus récents sont à la fin de la dernière page
    -- On parcourt du dernier au premier pour trouver un serveur disponible
    for i = #lastPageServers, 1, -1 do
        local server = lastPageServers[i]
        if server.id ~= currentJobId and server.playing < server.maxPlayers then
            return server
        end
    end

    -- Si tous les serveurs de la dernière page sont pleins ou c'est le serveur actuel,
    -- on prend n'importe quel serveur disponible de la dernière page
    for i = #lastPageServers, 1, -1 do
        local server = lastPageServers[i]
        if server.id ~= currentJobId then
            return server
        end
    end

    return nil
end

-- Téléportation vers le serveur récent
local function rejoinRecentServer()
    print("==========================================")
    print("[RejoinRecent] Script de rejoin serveur récent")
    print("[RejoinRecent] Place ID: " .. PLACE_ID)
    print("==========================================")

    local server = findRecentServer()

    if server then
        print(string.format(
            "[RejoinRecent] Serveur récent trouvé! Joueurs: %d/%d",
            server.playing,
            server.maxPlayers
        ))
        print("[RejoinRecent] Téléportation en cours...")

        local success, err = pcall(function()
            TeleportService:TeleportToPlaceInstance(PLACE_ID, server.id, LocalPlayer)
        end)

        if not success then
            warn("[RejoinRecent] Erreur de téléportation: " .. tostring(err))
            print("[RejoinRecent] Tentative de téléportation directe...")
            TeleportService:Teleport(PLACE_ID, LocalPlayer)
        end
    else
        print("[RejoinRecent] Aucun serveur récent disponible, téléportation directe...")
        TeleportService:Teleport(PLACE_ID, LocalPlayer)
    end
end

-- Exécution
rejoinRecentServer()
