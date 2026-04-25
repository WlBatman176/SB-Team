-- Thorfinn GUI Script
-- Clean GUI with Auto Win + Auto Farm Arena toggles

local Players = game:GetService("Players")
local RS = game:GetService("ReplicatedStorage")
local UIS = game:GetService("UserInputService")
local player = Players.LocalPlayer
local Remotes = RS:WaitForChild("Remotes")

-- State
local autoWinActive = false
local autoFarmArenaActive = false

-- Expected Wins value for Button16
local EXPECTED_WINS = 800000000000000

-- Colors
local ACCENT = Color3.fromRGB(130, 80, 230)
local BG_DARK = Color3.fromRGB(30, 30, 40)
local BG_PANEL = Color3.fromRGB(40, 40, 55)
local TEXT_WHITE = Color3.fromRGB(240, 240, 240)
local TEXT_DIM = Color3.fromRGB(160, 160, 175)
local GREEN = Color3.fromRGB(80, 200, 80)
local RED = Color3.fromRGB(200, 60, 60)

-- ScreenGui
local screenGui = Instance.new("ScreenGui")
screenGui.Name = "ThorfinnGUI"
screenGui.ResetOnSpawn = false
screenGui.ZIndexBehavior = Enum.ZIndexBehavior.Sibling
screenGui.Parent = player:WaitForChild("PlayerGui")

-- ============================================
-- Main panel
-- ============================================
local guiOpen = true
local PANEL_OPEN_SIZE = UDim2.new(0, 220, 0, 240)
local PANEL_CLOSED_SIZE = UDim2.new(0, 220, 0, 38)
local mainFrame = Instance.new("Frame")
mainFrame.Name = "MainFrame"
mainFrame.Size = UDim2.new(0, 220, 0, 240)
mainFrame.Position = UDim2.new(0, 12, 0.5, -120)
mainFrame.BackgroundColor3 = BG_DARK
mainFrame.BorderSizePixel = 0
mainFrame.Parent = screenGui

local mainCorner = Instance.new("UICorner")
mainCorner.CornerRadius = UDim.new(0, 10)
mainCorner.Parent = mainFrame

local mainStroke = Instance.new("UIStroke")
mainStroke.Thickness = 1.5
mainStroke.Color = ACCENT
mainStroke.Parent = mainFrame

-- ============================================
-- Title bar
-- ============================================
local titleBar = Instance.new("Frame")
titleBar.Name = "TitleBar"
titleBar.Size = UDim2.new(1, 0, 0, 38)
titleBar.BackgroundColor3 = ACCENT
titleBar.BorderSizePixel = 0
titleBar.Parent = mainFrame

local titleCorner = Instance.new("UICorner")
titleCorner.CornerRadius = UDim.new(0, 10)
titleCorner.Parent = titleBar

-- Bottom cover to make title bar flat at bottom
local titleCover = Instance.new("Frame")
titleCover.Size = UDim2.new(1, 0, 0, 12)
titleCover.Position = UDim2.new(0, 0, 1, -12)
titleCover.BackgroundColor3 = ACCENT
titleCover.BorderSizePixel = 0
titleCover.Parent = titleBar

local titleLabel = Instance.new("TextLabel")
titleLabel.Size = UDim2.new(1, -40, 1, 0)
titleLabel.Position = UDim2.new(0, 12, 0, 0)
titleLabel.BackgroundTransparency = 1
titleLabel.Text = "Thorfinn Hub"
titleLabel.TextColor3 = TEXT_WHITE
titleLabel.Font = Enum.Font.GothamBold
titleLabel.TextSize = 16
titleLabel.TextXAlignment = Enum.TextXAlignment.Left
titleLabel.Parent = titleBar

-- Close button (X)
local closeButton = Instance.new("TextButton")
closeButton.Name = "CloseButton"
closeButton.Size = UDim2.new(0, 28, 0, 28)
closeButton.Position = UDim2.new(1, -33, 0, 5)
closeButton.BackgroundColor3 = Color3.fromRGB(200, 50, 50)
closeButton.Text = "X"
closeButton.TextColor3 = TEXT_WHITE
closeButton.Font = Enum.Font.GothamBold
closeButton.TextSize = 14
closeButton.Parent = titleBar

local closeCorner = Instance.new("UICorner")
closeCorner.CornerRadius = UDim.new(0, 6)
closeCorner.Parent = closeButton

-- ============================================
-- "by Thorfinn" subtitle
-- ============================================
local subtitle = Instance.new("TextLabel")
subtitle.Size = UDim2.new(1, 0, 0, 20)
subtitle.Position = UDim2.new(0, 0, 0, 42)
subtitle.BackgroundTransparency = 1
subtitle.Text = "by Thorfinn"
subtitle.TextColor3 = TEXT_DIM
subtitle.Font = Enum.Font.GothamMedium
subtitle.TextSize = 11
subtitle.Parent = mainFrame

-- ============================================
-- Helper: create a toggle row
-- ============================================
local function createToggle(parent, name, yOffset)
    local row = Instance.new("Frame")
    row.Size = UDim2.new(1, -24, 0, 40)
    row.Position = UDim2.new(0, 12, 0, yOffset)
    row.BackgroundColor3 = BG_PANEL
    row.BorderSizePixel = 0
    row.Parent = parent

    local rowCorner = Instance.new("UICorner")
    rowCorner.CornerRadius = UDim.new(0, 8)
    rowCorner.Parent = row

    local label = Instance.new("TextLabel")
    label.Size = UDim2.new(1, -65, 1, 0)
    label.Position = UDim2.new(0, 12, 0, 0)
    label.BackgroundTransparency = 1
    label.Text = name
    label.TextColor3 = TEXT_WHITE
    label.Font = Enum.Font.GothamMedium
    label.TextSize = 13
    label.TextXAlignment = Enum.TextXAlignment.Left
    label.Parent = row

    local toggleBtn = Instance.new("TextButton")
    toggleBtn.Size = UDim2.new(0, 48, 0, 24)
    toggleBtn.Position = UDim2.new(1, -58, 0.5, -12)
    toggleBtn.BackgroundColor3 = RED
    toggleBtn.Text = "OFF"
    toggleBtn.TextColor3 = TEXT_WHITE
    toggleBtn.Font = Enum.Font.GothamBold
    toggleBtn.TextSize = 11
    toggleBtn.Parent = row

    local toggleCorner = Instance.new("UICorner")
    toggleCorner.CornerRadius = UDim.new(0, 6)
    toggleCorner.Parent = toggleBtn

    return toggleBtn
end

-- ============================================
-- Create toggles
-- ============================================
local autoWinBtn = createToggle(mainFrame, "Auto Win", 70)
local autoFarmBtn = createToggle(mainFrame, "Auto Farm Arena", 118)

-- ============================================
-- Make main panel draggable
-- ============================================
local dragging = false
local dragStart, frameStart

titleBar.InputBegan:Connect(function(input)
    if input.UserInputType == Enum.UserInputType.MouseButton1 or input.UserInputType == Enum.UserInputType.Touch then
        dragging = true
        dragStart = input.Position
        frameStart = mainFrame.Position
    end
end)

UIS.InputChanged:Connect(function(input)
    if dragging and (input.UserInputType == Enum.UserInputType.MouseMovement or input.UserInputType == Enum.UserInputType.Touch) then
        local delta = input.Position - dragStart
        mainFrame.Position = UDim2.new(
            frameStart.X.Scale, frameStart.X.Offset + delta.X,
            frameStart.Y.Scale, frameStart.Y.Offset + delta.Y
        )
    end
end)

UIS.InputEnded:Connect(function(input)
    if input.UserInputType == Enum.UserInputType.MouseButton1 or input.UserInputType == Enum.UserInputType.Touch then
        dragging = false
    end
end)

-- ============================================
-- Close / Open logic (collapse to title bar only)
-- ============================================
closeButton.MouseButton1Click:Connect(function()
    guiOpen = not guiOpen
    if guiOpen then
        mainFrame.Size = PANEL_OPEN_SIZE
        mainFrame.ClipsDescendants = false
    else
        mainFrame.Size = PANEL_CLOSED_SIZE
        mainFrame.ClipsDescendants = true
    end
end)

-- ============================================
-- Auto Win toggle (teleports player to Button16)
-- ============================================
autoWinBtn.MouseButton1Click:Connect(function()
    autoWinActive = not autoWinActive
    if autoWinActive then
        autoWinBtn.BackgroundColor3 = GREEN
        autoWinBtn.Text = "ON"
        task.spawn(function()
            while autoWinActive do
                pcall(function()
                    local button = workspace.Buttons.Button16
                    local winsVal = button and button:FindFirstChild("Wins")
                    if winsVal and tonumber(winsVal.Value) == EXPECTED_WINS then
                        firetouchinterest(player.Character:FindFirstChild("HumanoidRootPart"), button, 0)
                        task.wait()
                        firetouchinterest(player.Character:FindFirstChild("HumanoidRootPart"), button, 1)
                    end
                end)
                task.wait(0.1)
            end
        end)
    else
        autoWinBtn.BackgroundColor3 = RED
        autoWinBtn.Text = "OFF"
    end
end)

-- ============================================
-- Auto Farm Arena toggle (Rebirth MHP)
-- ============================================
autoFarmBtn.MouseButton1Click:Connect(function()
    autoFarmArenaActive = not autoFarmArenaActive
    if autoFarmArenaActive then
        autoFarmBtn.BackgroundColor3 = GREEN
        autoFarmBtn.Text = "ON"
        task.spawn(function()
            while autoFarmArenaActive do
                pcall(function()
                    local trainArea = workspace:FindFirstChild("Train Area")
                    if trainArea then
                        local arenaNode = trainArea:FindFirstChild("Rebirth")
                        if arenaNode then
                            Remotes:WaitForChild("MHP"):FireServer(arenaNode)
                        end
                    end
                end)
                task.wait(0.1)
            end
        end)
    else
        autoFarmBtn.BackgroundColor3 = RED
        autoFarmBtn.Text = "OFF"
    end
end)

-- ============================================
-- Destroy GUI button
-- ============================================
local destroyBtn = Instance.new("TextButton")
destroyBtn.Size = UDim2.new(1, -24, 0, 30)
destroyBtn.Position = UDim2.new(0, 12, 0, 168)
destroyBtn.BackgroundColor3 = Color3.fromRGB(150, 30, 30)
destroyBtn.Text = "Destroy GUI"
destroyBtn.TextColor3 = TEXT_WHITE
destroyBtn.Font = Enum.Font.GothamBold
destroyBtn.TextSize = 13
destroyBtn.Parent = mainFrame

local destroyCorner = Instance.new("UICorner")
destroyCorner.CornerRadius = UDim.new(0, 8)
destroyCorner.Parent = destroyBtn

destroyBtn.MouseButton1Click:Connect(function()
    autoWinActive = false
    autoFarmArenaActive = false
    screenGui:Destroy()
end)
