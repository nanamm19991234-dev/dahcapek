// This MakeCode extension for micro:bit allows identification of RFID cards using an expansion module with a PN532 connected via I2C.
// It should work with:
// - DFRobot Gravity module (https://wiki.dfrobot.com/Gravity:%20I2C%20&%20UART%20NFC%20Module%20SKU:%20DFR0231-H#target_5)
// - Elecfreaks Octopus module (https://wiki.elecfreaks.com/en/microbit/sensor/octopus-sensors/sensor/octopus_ef04105)
//
// Code is largely adapted from Octopus extension at https://github.com/elecfreaks/pxt-octopus/blob/master/main.ts

/**
 * Provides access to limited functionality of a PN532 NFC device.
 */
//% color=50 weight=1 icon="\uf02b" block="NFC1"
namespace NFC1 {

    let NFC_I2C_ADDR = (0x48 >> 1);
    let PN532_PREAMBLE = 0x00
    let PN532_STARTCODE1 = 0x00
    let PN532_STARTCODE2 = 0xFF
    let PN532_POSTAMBLE = 0x00
    let recvBuf = pins.createBuffer(32);
    let recvAck = pins.createBuffer(8);
    let ackBuf = pins.createBuffer(6);
    ackBuf[0] = 0x00;
    ackBuf[1] = 0x00;
    ackBuf[2] = 0xFF;
    ackBuf[3] = 0x00;
    ackBuf[4] = 0xFF;
    ackBuf[5] = 0x00;
    let uId = pins.createBuffer(4);
    let NFC_ENABLED = false;

    function writeAndReadBuffer(buf: Buffer, len: number) {
        pins.i2cWriteBuffer(NFC_I2C_ADDR, buf);
        basic.pause(100);
        recvAck = pins.i2cReadBuffer(NFC_I2C_ADDR, 8);
        basic.pause(100);
        recvBuf = pins.i2cReadBuffer(NFC_I2C_ADDR, len - 4);
    }

    function checkDcs(len: number): boolean {
        let sum = 0, dcs = 0;
        for (let i = 1; i < len - 2; i++) {
            if ((i === 4) || (i === 5)) {
                continue;
            }
            sum += recvBuf[i];
        }
        dcs = 0xFF - (sum & 0xFF);
        if (dcs != recvBuf[len - 2]) {
            return false;
        }
        return true;
    }

    function wakeup() {
        basic.pause(100);

        // Send command.
        let buf: number[] = [];
        buf = [PN532_PREAMBLE, PN532_STARTCODE1, PN532_STARTCODE2, 0x05, 0xFB, 0xD4, 0x14, 0x01, 0x14, 0x01, 0x02, PN532_POSTAMBLE];
        let cmdWake = pins.createBufferFromArray(buf);
        writeAndReadBuffer(cmdWake, 14);

        // Check acknowledgement and status.
        let i = 0;
        for (i = 0; i < ackBuf.length; i++) {
            if (recvAck[1 + i] != ackBuf[i]) {
                break;
            }
        }
        if ((i != ackBuf.length) || (recvBuf[6] != 0xD5) || (recvBuf[7] != 0x15) || (!checkDcs(14 - 4))) {
            NFC_ENABLED = false;
        } else {
            NFC_ENABLED = true;
        }

        basic.pause(100);
    }

    /**
     * Get a card/chip's ID as a string. Gets an empty string if no card/chip is found.
    */
    //% blockId=getCardId
    //% block="Get NFC card ID"
    //% weight=20
    export function getCardId(): string {
        if (!NFC_ENABLED) {
            wakeup();
        }

        // Send command.
        let buf: number[] = [];
        buf = [PN532_PREAMBLE, PN532_STARTCODE1, PN532_STARTCODE2, 0x04, 0xFC, 0xD4, 0x4A, 0x01, 0x00, 0xE1, PN532_POSTAMBLE];
        let cmdUid = pins.createBufferFromArray(buf);
        writeAndReadBuffer(cmdUid, 24);

        // Check acknowledgment and status.
        for (let i = 0; i < 4; i++) {
            if (recvAck[1 + i] != ackBuf[i]) {
                return '';
            }
        }
        if ((recvBuf[6] != 0xD5) || (!checkDcs(24 - 4))) {
            return '';
        }

        // Assemble ID from buffer.
        for (let i = 0; i < uId.length; i++) {
            uId[i] = recvBuf[14 + i];
        }

        // Final check for invalid ID.
        if (uId[0] === uId[1] && uId[1] === uId[2] && uId[2] === uId[3] && uId[3] === 0xFF) {
            return '';
        }

        // Create ID string.
        let uIdString = '';
        for (let i = 0; i < uId.length; i++) {
            uIdString += uId[i];
            if (i < uId.length - 1) {
                uIdString += ' ';
            }
        }
        return uIdString;
    }


    /**
     * Check for an NFC card/chip and then check whether it has a matching ID.
    */
    //% blockId=validateCardId
    //% block="NFC card ID matches $firstNum $secondNum $thirdNum $fourthNum"
    //% weight=10
    //% inlineInputMode=inline
    export function validateCardId(firstNum: number, secondNum: number, thirdNum: number, fourthNum: number): boolean {
        if (!NFC_ENABLED) {
            wakeup();
        }

        // Send command.
        let buf: number[] = [];
        buf = [PN532_PREAMBLE, PN532_STARTCODE1, PN532_STARTCODE2, 0x04, 0xFC, 0xD4, 0x4A, 0x01, 0x00, 0xE1, PN532_POSTAMBLE];
        let cmdUid = pins.createBufferFromArray(buf);
        writeAndReadBuffer(cmdUid, 24);

        // Check acknowledgment and status.
        for (let i = 0; i < 4; i++) {
            if (recvAck[1 + i] != ackBuf[i]) {
                return false;
            }
        }
        if ((recvBuf[6] != 0xD5) || (!checkDcs(24 - 4))) {
            return false;
        }

        // Assemble ID from buffer.
        for (let i = 0; i < uId.length; i++) {
            uId[i] = recvBuf[14 + i];
        }

        // Final check for invalid ID.
        if (uId[0] === uId[1] && uId[1] === uId[2] && uId[2] === uId[3] && uId[3] === 0xFF) {
            return false;
        }

        if (uId[0] == firstNum && uId[1] == secondNum && uId[2] == thirdNum && uId[3] == fourthNum) {
            return true;
        }

        return false;
    }

    /**
     * Check for an NFC card/chip and then check whether it has a matching ID.
    */
    //% blockId=checkForCard
    //% block="Card present"
    //% weight=30
    export function checkForCard(): boolean {
        if (!NFC_ENABLED) {
            wakeup();
        }

        // Send command.
        let buf: number[] = [];
        buf = [PN532_PREAMBLE, PN532_STARTCODE1, PN532_STARTCODE2, 0x04, 0xFC, 0xD4, 0x4A, 0x01, 0x00, 0xE1, PN532_POSTAMBLE];
        let cmdUid = pins.createBufferFromArray(buf);
        writeAndReadBuffer(cmdUid, 24);

        // Check acknowledgment and status.
        for (let i = 0; i < 4; i++) {
            if (recvAck[1 + i] != ackBuf[i]) {
                return false;
            }
        }
        if ((recvBuf[6] != 0xD5) || (!checkDcs(24 - 4))) {
            return false;
        }

        // Assemble ID from buffer.
        for (let i = 0; i < uId.length; i++) {
            uId[i] = recvBuf[14 + i];
        }

        // Final check for invalid ID.
        if (uId[0] === uId[1] && uId[1] === uId[2] && uId[2] === uId[3] && uId[3] === 0xFF) {
            return false;
        }

        return true;
    }

}

