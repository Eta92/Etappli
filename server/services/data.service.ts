import { Appli } from '../models/appli.model';

const fs = require('fs');

export class DataService {
  public static dataInit = false;
  public static allApplis: Array<Appli> = [];

  public static init = () => {
    // load applies
    this.allApplis = [];
    this.loadGames();
    this.dataInit = true;
    console.log('DataService initialized with', this.allApplis.length, 'applis');
  };

  private static loadGames = () => {
    const jsonData = fs.readFileSync('../assets/data/apps_game.json');
    const games = JSON.parse(jsonData);
    games.forEach((game: Appli) => {
      this.allApplis.push(game);
    });
  };

  public static getAllApplis = (): Array<Appli> => {
    return this.allApplis;
  };
}
