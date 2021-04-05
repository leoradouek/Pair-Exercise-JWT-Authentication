const Sequelize = require('sequelize');
const jwt = require('jsonwebtoken');
const bcrpyt = require('bcrypt');

const {STRING} = Sequelize;
const config = {
	logging: false,
};

if (process.env.LOGGING) {
	delete config.logging;
}
const conn = new Sequelize(
	process.env.DATABASE_URL || 'postgres://localhost/acme_db',
	config
);

const User = conn.define('user', {
	username: STRING,
	password: STRING,
});
const Note = conn.define('note', {
	text: STRING,
});
Note.belongsTo(User);
User.hasMany(Note);

const saltRounds = 10;
User.beforeCreate(user => {
	const hash = bcrpyt.hashSync(user.password, saltRounds);
	user.password = hash;
});

User.byToken = async token => {
	try {
		const decoded = jwt.verify(token, process.env.JWT);
		const user = await User.findByPk(decoded.userId);

		if (user) {
			return user;
		}
		const error = Error('bad credentials');
		error.status = 401;
		throw error;
	} catch (ex) {
		const error = Error('bad credentials');
		error.status = 401;
		throw error;
	}
};

User.authenticate = async ({username, password}) => {
	const user = await User.findOne({
		where: {
			username,
		},
	});
	bcrpyt.compareSync(password, user.password);
	if (user) {
		return jwt.sign({userId: user.id}, process.env.JWT);
	}
	const error = Error('bad credentials');
	error.status = 401;
	throw error;
};

const syncAndSeed = async () => {
	await conn.sync({force: true});
	const credentials = [
		{username: 'lucy', password: 'lucy_pw'},
		{username: 'moe', password: 'moe_pw'},
		{username: 'larry', password: 'larry_pw'},
	];
	const notes = [{text: 'Stuffy '}, {text: 'Stuff '}, {text: 'Stuffed '}];
	const [lucy, moe, larry] = await Promise.all(
		credentials.map(credential => User.create(credential))
	);
	const [text1, text2, text3] = await Promise.all(
		notes.map(note => Note.create(note))
	);
	await lucy.setNotes([text1, text2]);
	await moe.setNotes(text3);
	return {
		users: {
			lucy,
			moe,
			larry,
		},
		notes: {
			text1,
			text2,
			text3,
		},
	};
};

module.exports = {
	syncAndSeed,
	models: {
		User,
		Note,
	},
};
