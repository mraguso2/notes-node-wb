exports.myMiddleware = (req, res, next) => {
  req.name = 'Mike';
  next(); // done with my work, now pass on to the next
};

exports.homePage = (req, res) => {
  console.log(req.name);
  res.render('index');
};