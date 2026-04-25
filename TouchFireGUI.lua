-- TouchFire GUI Script
-- Toggle button (Green = ON / Red = OFF)
-- Fires workspace.Buttons.Button16.TouchInterest + Auto Train Arena Rebirth when ON

local Players = game:GetService("Players")
local RS = game:GetService("ReplicatedStorage")
local player = Players.LocalPlayer
local Remotes = RS:WaitForChild("Remotes")

-- Create ScreenGui
local screenGui = Instance.new("ScreenGui")
screenGui.Name = "TouchFireGUI"
screenGui.ResetOnSpawn = false
screenGui.ZIndexBehavior = Enum.ZIndexBehavior.Sibling
screenGui.Parent = player:WaitForChild("PlayerGui")

-- Create toggle button
local toggleButton = Instance.new("TextButton")
toggleButton.Name = "ToggleButton"
toggleButton.Size = UDim2.new(0, 70, 0, 28)
toggleButton.Position = UDim2.new(0, 10, 0.5, -20)
toggleButton.BackgroundColor3 = Color3.fromRGB(255, 50, 50)
toggleButton.TextColor3 = Color3.fromRGB(255, 255, 255)
toggleButton.Text = "OFF"
toggleButton.Font = Enum.Font.GothamBold
toggleButton.TextSize = 13
toggleButton.Parent = screenGui

-- Rounded corners
local corner = Instance.new("UICorner")
corner.CornerRadius = UDim.new(0, 8)
corner.Parent = toggleButton

-- Stroke for visibility
local stroke = Instance.new("UIStroke")
stroke.Thickness = 2
stroke.Color = Color3.fromRGB(255, 255, 255)
stroke.Parent = toggleButton

-- Make button draggable
local dragging = false
local dragStart, startPos

toggleButton.InputBegan:Connect(function(input)
    if input.UserInputType == Enum.UserInputType.MouseButton1 or input.UserInputType == Enum.UserInputType.Touch then
        dragging = true
        dragStart = input.Position
        startPos = toggleButton.Position
    end
end)

toggleButton.InputChanged:Connect(function(input)
    if dragging and (input.UserInputType == Enum.UserInputType.MouseMovement or input.UserInputType == Enum.UserInputType.Touch) then
        local delta = input.Position - dragStart
        toggleButton.Position = UDim2.new(
            startPos.X.Scale, startPos.X.Offset + delta.X,
            startPos.Y.Scale, startPos.Y.Offset + delta.Y
        )
    end
end)

toggleButton.InputEnded:Connect(function(input)
    if input.UserInputType == Enum.UserInputType.MouseButton1 or input.UserInputType == Enum.UserInputType.Touch then
        dragging = false
    end
end)

-- Toggle state
local active = false

toggleButton.MouseButton1Click:Connect(function()
    active = not active
    if active then
        toggleButton.BackgroundColor3 = Color3.fromRGB(50, 200, 50)
        toggleButton.Text = "ON"

        -- Start Auto Train Arena Rebirth loop in a separate thread
        task.spawn(function()
            while active do
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
        toggleButton.BackgroundColor3 = Color3.fromRGB(255, 50, 50)
        toggleButton.Text = "OFF"
    end
end)

-- Main loop: fire TouchTransmitter (Button16) when active
while true do
    if active then
        pcall(function()
            local button = workspace.Buttons.Button16
            if button then
                firetouchinterest(player.Character:FindFirstChild("HumanoidRootPart"), button, 0)
                task.wait()
                firetouchinterest(player.Character:FindFirstChild("HumanoidRootPart"), button, 1)
            end
        end)
    end
    task.wait(0.1)
end
