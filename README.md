# React Native Game Engine PROTOTYPE
### Introduction
Hello, welcome to this repo. It is likely that no one will ever read this except for myself. 
I have made multiple games in react native before. It is not friendly; React's api, its lifecycle, is designed for UII not games. Its meant to be reactaive (hence the name)
to input. Games are meant to constantly run, they process user input but keep going with or without it. So react is kinda the last thing you'd want to use for a game. 
Games are also intended to be performant, spinning up an entire js runetime on a mobile device is not my idea of performance. Essentially what I am saying 
is that react native might be the worst choice for this. So why do it? well first of all react native builds on andriod and ios with one codebase, 
but more importantly because I spent a lot of time dealing with this issues and found solutions I want to make into a framework.
How is it possible? I am glad you asked, this is all made possible thanks to our best friends,
react native skia, and react native reanimated. This allows us to run code and draw all on the UI thread, giving us performance. However currently we are ignoring this lmao.

The api I used for my projects was... messy to say the least. Its difficult to put everything on the UI thread, difficult to communicate accross them.

So we are just gonna build everything in typescript and deal with that later.
