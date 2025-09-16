<img src="website/img/kopipescanner.png" width="150" height="150">

# Info
This is a website that scans links for files uploaded to KOPIPE and displays all of the files.

* Official instance: https://kopipescanner.luckyc.dev

# Installation

1. Install [NodeJS](https://nodejs.org/en/download)
2. Clone this repo (`git clone https://github.com/luckycdev/kopipescanner.git`)
3. Inside of the cloned repos directory (`cd kopipescanner`), enter the server directory (`cd server`)
4. Inside of the server directory, run `npm init -y`, and then `npm install`
5. If you are using nginx on linux, create a file in your sites-enabled directory with whatever your domain is, and use [this](https://pastebin.com/raw/fVaLtKYd) __as a reference__ -- you will need to change the lines with comments -- for certs you can use `sudo cerbot --nginx` (tested on nginx ubuntu v1.18.0 & certbot v4.0.0 but should work on latest)
6. To start the backend server, you will simply run `node server.js` inside of the server directory. I recommend you use something like screen to keep the server alive when you close out of your SSH.

<details>
<summary>linux screen tutorial</summary>

Install Screen `sudo apt install screen`
  
Create the screen `screen -S kopipescanner`

And then if you want to return to your screen, run `screen -r kopipescanner`

If you want to kill your screen, run `screen -X -S kopipescanner kill`
</details>

7. The site should be running at the domain and your server should be working!

* Note: if using nginx on linux you may have to run `sudo chmod -R 755 kopipescanner/` (change the "kopipescanner/" to the path of your housing directory) for nginx to make the website work (and then maybe `sudo systemctl reload nginx` and/or `sudo systemctl restart nginx`)

### Help can be found at https://discord.gg/AQ4sDF6Mkz

## Roadmap / to-do list
- fix css and mobile ui