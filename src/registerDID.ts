import fs from 'fs';
import path from 'path';
import * as uint8arrays from 'uint8arrays';
import { Secp256k1Keypair } from '@atproto/crypto';
import * as atprotoIdentity from '@atproto/identity';

// function to generate and save AT Protocol compatible keys
async function generateKeyPair() {
    try {
        // generate Secp256k1 keypair (preferred)
        const keypair = await Secp256k1Keypair.create();

        // export keys as bytes
        const privateKeyBytes = await keypair.export();

        // get public key bytes - v0.3.0
        let publicKeyBytes;
        try {
            publicKeyBytes = keypair.publicKey;
        } catch (e) {
            console.log("Using alternative method to get public key");
            publicKeyBytes = await privateKeyBytes.slice(32);
        }

        // convert to base64 for storage
        const publicKeyBase64 = uint8arrays.toString(publicKeyBytes, 'base64');
        const privateKeyBase64 = uint8arrays.toString(privateKeyBytes, 'base64');

        // ensure keys directory exists
        const keysDir = path.join(__dirname, "../keys");
        if (!fs.existsSync(keysDir)) {
            fs.mkdirSync(keysDir, { recursive: true });
        }

        // save keys to files
        fs.writeFileSync(path.join(keysDir, "publicKey.b64"), publicKeyBase64);
        fs.writeFileSync(path.join(keysDir, "privateKey.b64"), privateKeyBase64);

        console.log("🔑 AT Protocol Key Pair Generated! Keys saved in 'keys/' directory.");

        // return keypair for immediate use
        return keypair;
    } catch (error) {
        console.error("Failed to generate key pair:", error);
        throw error;
    }
}

// function to load existing keys
async function loadKeyPair() {
    try {
        const keysDir = path.join(__dirname, "../keys");
        console.log(`Looking for keys in: ${keysDir}`);

        const privateKeyBase64 = fs.readFileSync(path.join(keysDir, "privateKey.b64"), "utf8").trim();

        const privateKeyBytes = uint8arrays.fromString(privateKeyBase64, 'base64');

        // import key
        const keypair = await Secp256k1Keypair.import(privateKeyBytes);

        console.log("🔑 Loaded existing key pair from 'keys/' directory.");
        return keypair;
    } catch (error: any) {
        console.error("Failed to load key pair, generating new one:", error);
        return generateKeyPair();
    }
} 

// function to register DID with PLC directory
async function registerDID(keypair: Secp256k1Keypair) {
    try {
        // get DID string from keypair
        const did = keypair.did();

        // generate a separate recovery keypair
        console.log("Generating recovery key...");
        const recoveryKeyPair = await Secp256k1Keypair.create();
        const recoveryDid = recoveryKeyPair.did();

        // save recovery key
        const recoveryKeyBytes = await recoveryKeyPair.export();
        const recoveryKeyBase64 = uint8arrays.toString(recoveryKeyBytes, 'base64');
        const keysDir = path.join(__dirname, "../keys");
        fs.writeFileSync(path.join(keysDir, "recoveryKey.b64"), recoveryKeyBase64);
        console.log("💾 Recovery key saved to 'keys/recoveryKey.b64'");

        // replace YOUR_HANDLE with your handle
        const handle = process.env.BLUESKY_HANDLE || "k1nghandy.bsky.social";

        // create PLC client
        const plc = new atprotoIdentity.PLC.Client("https://plc.directory");

        // register DID
        console.log(`Registering DID for handle: ${handle}`);
        console.log(`Using DID: ${did}`);
        console.log(`Using recovery DID: ${recoveryDid}`);

        const result = await plc.createDid({
            signingKey: did,
            handle: handle,
            pds: "https://bsky.network",
            recoveryKey: recoveryDid
        });

        console.log("✅ DID Registration Successful", result);
        return result;
    } catch (error: any) {
        console.error("❌ DID Registration Failed", error.message);
        if (error.response && typeof error.response === 'object') {
            console.error("Status code:", error.response.status);
            console.error("Response details:", JSON.stringify(error.response.data, null, 2));
        }
        throw error;
    }
}

async function main() {
    try {
        // generate new keys or load existing
        console.log("Setting up cryptographic keys...");
        const keypair = await loadKeyPair();

        // register DID with keys
        console.log("Registering DID with PLC directory...");
        const result = await registerDID(keypair);

        console.log("Registration complete with DID:", result.did);
    } catch (error) {
        console.error("Process failed:", error);
        process.exit(1)
    }
}

// execute main
main();
