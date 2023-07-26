const express = require("express");
const cors = require("cors");
const { Builder, By, until } = require("selenium-webdriver");
const chrome = require("selenium-webdriver/chrome");
const { Options } = require("selenium-webdriver/chrome");
const { parse } = require("node-html-parser");
const csvWriter = require("csv-writer").createObjectCsvWriter;
const fs = require("fs");
const chromedriver = require("chromedriver");

const app = express();
const port = 5000;

app.use(cors());
app.use(express.json());

const email=["rudranilbanerjee192@gmail.com","rudranil.banerjee@rebininfotech.com"];
const linkPassword=["Rudranil@123","Rudranil@12345@1999"]
const chromeOptions = new Options();
// chromeOptions.addArguments('--headless'); // Enable headless mode
let i=0;
app.post("/scrape", async (req, res) => {
  const { url } = req.body;
  const options = new chrome.Options();
  // options.addArguments("--headless"); // Run Chrome in headless mode (without GUI)
  chromeOptions.addArguments("--disable-extensions");

  const driver = await new Builder()
    .forBrowser("chrome")
    .setChromeOptions(options)
    .build();
  if(i===email.length || i===linkPassword.length){
    i=0;
  }
  try {
    
    await driver.get("https://www.linkedin.com");

    const username = await driver.wait(
      until.elementLocated(By.id("session_key")),
      10000
    );
    await username.sendKeys(email[i]);

    const password = await driver.findElement(By.id("session_password"));
    await password.sendKeys(linkPassword[i]);

    const signInButton = await driver.findElement(
      By.xpath('//*[@type="submit"]')
    );
    await signInButton.click();

    await driver.sleep(5000);

    await driver.get(url);
    const scrollCount = 30; // Number of times to scroll

    for (let i = 0; i < scrollCount; i++) {
      await driver.executeScript('window.scrollBy(0, window.innerHeight);');//window.innerHeight
      await driver.sleep(Math.random() * (4.9 - 2.5) * 1000 + 2.5 * 1000);
    }

    // for (let i = 0; i < scrollCount; i++) {
    //     await driver.executeScript('window.scrollTo(0, document.body.scrollHeight);');
    //     await driver.sleep(Math.random() * (4.9 - 2.5) * 1000 + 2.5 * 1000);
    // }

    const filePath = 'output.html';

    const pageSource = await driver.getPageSource();
    const root = parse(pageSource);
    fs.writeFile(filePath, pageSource, (err) => {
      if (err) {
        console.error(err);
      } else {
        console.log('HTML file has been successfully saved!');
      }
    });
    const othersParent = root.querySelectorAll("div.feed-shared-update-v2");

    const records = [];

    for (const item of othersParent) {
      let actorDiv = item.querySelector(
        "div.update-components-actor.display-flex"
      );
      const post_element = item.querySelector("span.break-words");
      const post = post_element
        ? post_element.text.replace(/\s+/g, " ").trim()
        : "No post found";

      if (!actorDiv) {
        actorDiv = item.querySelector(
          "div.update-components-actor.display-flex.update-components-actor--with-control-menu"
        );
      }

      const anchorDiv = actorDiv.querySelector(
        "a.app-aware-link.update-components-actor__container-link.relative.display-flex.flex-grow-1"
      );
      const profileLink = anchorDiv.getAttribute("href");
      const anchorTitleTag = anchorDiv.querySelector(
        "span.update-components-actor__title"
      );
      const userName = anchorTitleTag.querySelector(
        "span.visually-hidden"
      ).text;
      const actorDescriptionTag = anchorDiv.querySelector(
        "span.update-components-actor__description.t-black--light.t-12.t-normal"
      );
      const designation = actorDescriptionTag.querySelector(
        "span.visually-hidden"
      ).text;
      const actorSubDescriptionTag = anchorDiv.querySelector(
        "div.update-components-text-view.break-words"
      );
      const postUploadDay = actorSubDescriptionTag?.querySelector(
        "span.visually-hidden"
      ).text;
      const days = postUploadDay.replace(/\D/g, "");

      let followers = "0";
      let designationText = designation;

      if (designation.includes("followers")) {
        followers = designation.replace(" followers", "");
        designationText = "None";
      }

      const record = {
        UserName: userName,
        "User Profile Link": profileLink,
        Designation: designationText,
        Followers: followers,
        "Posted Days": `${days} days ago`,
        Post: post,
      };

      records.push(record);
    }

    const output_file = "linkedin_user_details.csv";
    const csvWriterOptions = {
      path: output_file,
      header: [
        { id: "UserName", title: "UserName" },
        { id: "User Profile Link", title: "User Profile Link" },
        { id: "Designation", title: "Designation" },
        { id: "Followers", title: "Followers" },
        { id: "Posted Days", title: "Posted Days" },
        { id: "Post", title: "Post" },
      ],
    };

    await csvWriter(csvWriterOptions)
      .writeRecords(records)
      .then(() => {
        console.log("Data has been scraped and saved to", output_file);

        // Send the CSV file to the user for download
        res.download(output_file, (err) => {
          if (err) {
            console.error("Error sending CSV file:", err);
            res.status(500).send("Internal Server Error");
          } else {
            console.log("CSV file sent to the user");
            // Remove the temporary CSV file
            fs.unlinkSync(output_file);
          }
        });
      })
      .catch((error) => {
        console.error("Error writing file:", error);
        res.status(500).send("Internal Server Error");
      });

    await driver.quit();
    i++;
  } catch (error) {
    console.error("An error occurred:", error);
    await driver.quit();
    res.status(500).send("Internal Server Error");
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});