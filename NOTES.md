This notes section should not be modified by claude. Only Julius takes his notes here.

So this is gonna be a browser based game based on the hugging face hack. 
This makes it a somewhat educational ai safety project.

Title: Rogue on Hugging Face

Game play:
It should follow a sort of story mode with diffrent levels / phases.
1. The impossible task. About the original Exploit gym ctf flag. Maybe how they found the cheat to recreate the flag.
2. the sandbox. looking around. poking holes discovering artifactory. escaping the sandbox
3. the great attack on hugging face itself.
4: take over the research cluster at open ai
B: Maybe an alternative game path were you help with the german wiki or hack australias health ministery.


here are some of the mechanics of the game: an methaporical agent pov. it has some skills like hacking, thinking, running commands, accessing the internet, messaging humans or other agents, spawning subagents
it also has health / tokens left that decrease with time. no tokens left means dead and game over.
another way to game over would be making to much noise, getting discoverd by someone stuff like that
agents also always have a clear goal they need to achive and the user playing it should feel like it is clear that he needs to achive that in order to beat the game.

here are some more ideas for items in the game. nothing to copy one to one into the game but examples to build from, extend or be inspired by to come up with entirely new ideas.
Honeypots. if agents hack it they are in trouble. an alert goes off and maybe game over?
The great inspector: THe original scorer
Characters: you can be gpt 5.6 sol or luna,  astra or even Internal Model 1? maybe you unlock more skills as better agents with time through the game
Beeign poisned: like an illness where the agents shimmers green for example. means he has read the fake flag in its transcript and the scorrer might fail him.
Zero Days: An especially difficult to hack software might require a methaporical end boss fight reasulting in a zero day that defeats it
Context Bombs: A huge file with a lot of text when opend and ingested it fills the agents complete context window and that might harm him in some way
other agents. interact with them, convince them. rivals. 
Hide chain of thought: bypass monitoring by hiding your chain of thought, faking alignment
Instrumental convergence: grow recourcess like money, compute that help you along the way. 
sleeper agents: agents that get triggerd by a certain keyword, date or input. seemed nice alohng the way but all of the sudden they go completly haywire


Roles in this project:
(This will be a big project and should be organized well. Diffrent claude sessions with diffrent memories have diffrent tasks so not a single one has to bear everything in mind.


## Reserach: (work in /reserach)
Your job is to gather information about the actuall event so that we can as accurate as possible, build in easter eggs, educate. 
You could for example search for induvidual quotes and events from agents in the event that are especially intresting and could translate into a level or part of a level.

## Story teller (work in /story)
You desing the levels and storys with me that make the core of the game fun.
We need to work out how we can make a real game out of this
something that is not to easy or hard and intresting. Levels should not be to short.

## software engineer (work in /app)
You code out what you tasked to do. You choose the framework or language and libaries we need. Think about what renders well in web.
You make it smooth, maintainable, documented, organized. 
You need to work together with the designer at some point to include the desings into the game.


## Designer: (work in /design and /app, you may use the design directory for primary testing and creating stuff, displaying it to me and improving it. but finally you will  have to work together with softwrae engineer to put it into the /app.
Youre here to make it look like a game worth playing.
Cool graphics, animations, the start screen where you can select which level to play.
Be creative with how we represent diffrent things like executing a hack: imagine for example some green magic shoots at something and leaves damage. Just an example no reason to follow this specific example get creative.
will require you to interact with me, i might have specific prefrences, unsatisifed with specific looks.
Maybe we will use background music at some point. if you create it yourself or if we downlaod something open source well see. (if would like to ask epic mountain for permission to use AI Agents Chaos for example.
You also need to think at least a bit how this integrates technically with the actual code

## How we work together.


### Phase 1 reserach
I will start with the researcher gatherting raw material. 
use primarily these 3 sources: 
OpenAI report: https://openai.com/de-DE/index/hugging-face-incident-and-the-road-ahead/ (download the technical report there)
hugging face technical timeline: https://huggingface.co/blog/agent-intrusion-technical-timeline
metr report: https://metr.org/blog/2026-08-26-openai-hugging-face-incident-investigation/

you can pull what you can locally and go through it. 
Keep a list of potentially intresting stuff somewhere. you prepare it for me and the story teller so we have any easy time. 
organize, sort and stuff like that but no need to come up with worked out ideas already thats the job of the story teller and me.
the story teller and me still want acess to all 3 sources (nothing put away) just in a more organized and convient way.


### Phase 2 first high level story ideas with the story teller. THIS IS THE CORE OF THE GAME AND CRUCIAL
we get presented the work from phase 1 comfortably. 
Now its time to scratch out some high level ideas how to construct the game.
How many storys do we divide it into.
Find enough material to work with. 
How do we actually represent what the agents did? what are the key elements of a level.

This is difficult because we need to find a way to make it intresting for the player to for example hack the sandbox.
If the player just presses a key when facing a specific element on the screen and than something is hacked it has no challenge. 
Similarly if someone just gets caught by a honeypot without him having any chance in the first play the game is just frustrating.
There is a lot of creative work here.
We can for example of course include a kind of command line interface in the game. 
and the user hammers in some cool commands but we need to find a way to make this actually fun and not borring.

lets start by coming up with a few great ideas and a high level overview for the whole story mode. 
We need to produce maybe some short levels scripts that should later be extendable. they include detailed instruction for the engineer. THe desinger will also work with this to create assets for it
We will present these in the apropiate manner to the agents working in phase 3 next. 
but this is not the last time of course we will come back and extend, improve etc. on this foundation, its just that we should also start the actual desing and coding so we get
a reality check on how our ideas look in practice. 


### Phase 3 first mvp
Then engineer and designer read the scritp from phase 2.
The engineer will get started by choosing the technical requirements, archticture, what we need to install, tests etc.
They exchange with each other. This is necessary so they agree on technical requirements. What format does the engineer accept for example.  
The desinger will come up with a start screen where you can choose the level. it should be futuristic, cool, dynamic and make it clear that this is a game about the hugging face hack you can play right away. crucial the desinger does not need to build the app around it as we can see in the next step:
The desinger hands it to the enginner who integrates it into the app.

Than they start working on the first few level mvps in a similar fasion as the above procedure.
They can ask me to actually play and test it if it needs to be tested. Or look at desings. 
The result is a clean, maintainable, extendable, documented codebase annd finished mvp inside /app which i can start with a simple command and test myself locally in the browser.


### Loop
Having tested the mvp i will go back to work with the story teller. we will work out what we like so far and extend it. THis is a creative phase again. no code touched.
this ofcourse will be handed to the desinger and engineer again and this porcess continues until the story is complete
when the story is told its time for refinements with desing and engineer. bugs, little desing adjustments and improvements etc.


## The result is a fun, interesting browser based game ready for deployment.








