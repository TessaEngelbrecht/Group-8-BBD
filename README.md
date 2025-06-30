### Group-8-BBD
Tlou Models

Player Model
------------

 Attribute  Description           
 ----------------------
 id       Unique identifier     
 name     Player name           
 moves    Movement capabilities 
 health   Health points         
 score    Player score          
 booster  Current boost level   
 weapon   Equipped weapon       


Weapon Model
------------
Attribute      Description                           
---------------------------
 id          Unique identifier                     
 name         Weapon name                           
 health       Weapon durability or impact on health 
 power_boost  Power or boost stats                  

Global Methods
--------------
Player Interaction
------------------
accumulatePoints() – Increases score
move(direction) – Moves player: [Left, Right, Down, Up]
life += 100 – Gain life
death = 10 – Lose life
boostUp += 20 – Increase boost
shoot(target) – Attack: reduce opponent's points, increase own
laser(size, velocity, direction) – Fire laser

Utility Method
---------------
getPosition() – Get player position
reset() – Reset player or game state


Obstruction Model
-----------------
 Attribute   Description         
------------------------ 
id        Unique identifier   
name      Obstruction name    
position  Coordinates on map  
type       Type of obstruction 

Methods
-------
accumulatePoints()
reducePoints()
death()
shoot()

Enemy Model
-----------
 Attribute   Description 
 -----------------------        
id        Unique identifier  
type      Enemy type          
position  Location on the map 

Methods
-------
accumulatePoints()
 reducePoints()F
 death()
 shoot()


Laser Model
-----------
 Attribute   Description        
------------------------
 id        Unique identifier  
 position  Location on map    
 type      Type of laser      
 color     Laser color        
 size      Size of laser beam 

Methods
-------------
 shoot()
 Player can activate and use laser


Dependencies
------------
 TensorFlow.js - tfjsmodel 
 JavaScript (frontend) – Game logic & UI
 Firebase.js – Realtime database or auth services

