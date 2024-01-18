function register() {
  // background.js
  tcLogger("[runtime] [onMessage]", "REGISTER ");
  chrome.runtime.onMessage.addListener(
    async (request, sender, sendResponse) => {
      tcLogger("[runtime] [onMessage]", "CALLBACK ", {
        request,
        sender,
        sendResponse,
      });

      let userConfirmation = confirm(
        "Do you want to save the file to the Vault?"
      );
      console.log(
        "[runtime] [onMessage]",
        "CALLBACK USER_SELECTION",
        userConfirmation
      );

      await chrome.runtime.sendMessage({
        tabId: request.tabId,
        download: request.download,
        saveToVault: userConfirmation,
      });
    }
  );
}

function readFileFromServerAndUpload(_req) {
  let headers = {};
  if (_req.capturedRequest && _req.capturedRequest.requestHeaders) {
    let capturedHeaders = _req.capturedRequest.requestHeaders;

    capturedHeaders.forEach((item) => {
      headers[item.name.toLowerCase()] = item.value;
    });
  }
  console.log("HEADERS ", headers);

  console.log("CALLING [readFileFromServerAndUpload]");
  // Replace these URLs with the actual URLs of the servers
  console.log("BEFORE ENCODING ", _req.download.finalUrl);
  const sourceServerUrl = decodeURIComponent(_req.download.finalUrl);
  console.log("AFTER ENCODING ", _req.download.finalUrl);
  //   let apiUrl = "https://trustedcopy.azurewebsites.net/api/document/save";
  let apiUrl = "https://localhost:44351/api/document/save";
  const destinationServerUrl = "https://destination-server.com/upload";

  // Fetch the file from the source server
  fetch(sourceServerUrl, {
    headers: headers,
    credentials: "include",
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error("Failed to fetch the file from the source server.");
      }
      return response.blob();
    })
    .then((fileBlob) => {
      console.log("READ SUCCESS we've the BLOB");
      // Upload the file to the destination server
      uploadFileToServer(apiUrl, fileBlob);
    })
    .catch((error) => {
      console.error("[readFileFromServerAndUpload] Error:", error);
    });
}

function uploadFileToServer(destinationUrl, fileBlob) {
  console.log("CALLING [uploadFileToServer]");
  // Create a FormData object and append the file blob to it
  var formdata = new FormData();
  formdata.append("deviceCode", "7B9LGYP3EK");
  formdata.append("local_ip", "127.0.0.1");
  formdata.append("public_ip", "10.10.10.10");
  formdata.append("local_datetime", "01/01/2023");
  formdata.append("timezone", "PKT");
  formdata.append("description", "Special Folder");
  formdata.append("attachment", fileBlob, "document");
  formdata.append("no_of_pages", "111");

  // Make an HTTP request to upload the file to the destination server
  fetch(destinationUrl, {
    method: "POST",
    body: formdata,
  })
    .then((response) => {
      if (response.ok) {
        alert("File uploaded successfully to the destination server.");
      } else {
        alert("Error uploading file to the destination server.");
      }
    })
    .catch((error) => {
      console.error("[uploadFileToServer] ERROR:", error);
    });
}

let tcLogger = function (_tag, _msg, _params, _error) {
  if (_error) {
    if (_params) {
      console.error(_tag, _msg, _params);
      return;
    }
    console.error(_tag, _msg);
    return;
  }
  if (_params) {
    console.log(_tag, _msg, _params);
    return;
  }
  console.log(_tag, _msg);
};

register();
